"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { HealthRing } from "~/components/ui/health-ring";
import { TextReveal, FadeIn } from "~/components/ui/text-reveal";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import { 
  // Intelligence & Security Icons
  RiShieldLine, 
  RiEyeLine, 
  RiLockLine,
  RiGlobalLine,
  RiFileTextLine,
  RiBarChartLine,
  // Diplomatic Icons
  RiShakeHandsLine,
  RiTeamLine,
  RiBuildingLine,
  RiFlagLine,
  // Activity & Social Icons
  RiNotification3Line,
  RiChat3Line,
  RiUserAddLine,
  RiStarLine,
  // Navigation Icons
  RiArrowRightLine,
  RiExternalLinkLine,
  RiRefreshLine,
  // Intelligence Glyphs (using available icons as diplomatic glyphs)
  RiSearchLine,
  RiScanLine,
  RiWifiLine, // Replace RiSatelliteLine
  RiSettings3Line,
  // Economic & Demographic Icons
  RiMoneyDollarCircleLine,
  RiSubtractLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiMapLine,
  RiInformationLine,
  RiMapPinLine
} from "react-icons/ri";

import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";
import { EmbassyNetworkVisualization } from "~/components/diplomatic/EmbassyNetworkVisualization";
import { SecureDiplomaticChannels } from "~/components/diplomatic/SecureDiplomaticChannels";
import { CulturalExchangeProgram } from "~/components/diplomatic/CulturalExchangeProgram";
import { AchievementConstellation } from "~/components/achievements/AchievementConstellation";
import { AchievementUnlockModal } from "~/components/achievements/AchievementUnlockModal";
import { LiveDiplomaticFeed } from "~/components/diplomatic/LiveDiplomaticFeed";
import { DiplomaticLeaderboards } from "~/components/diplomatic/DiplomaticLeaderboards";
import { SocialActivityFeed } from "~/components/diplomatic/SocialActivityFeed";
import { AdvancedSearchDiscovery } from "~/components/diplomatic/AdvancedSearchDiscovery";
import { RealTimeAchievementNotifications } from "~/components/achievements/RealTimeAchievementNotifications";
import { EnhancedIntelligenceBriefing } from "~/components/countries/EnhancedIntelligenceBriefing";
import { WikiIntelligenceTab } from "~/components/countries/WikiIntelligenceTab";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { DynamicIsland, DynamicContainer, DynamicTitle, DynamicDiv, DynamicIslandProvider, SIZE_PRESETS } from "~/components/ui/dynamic-island";
import type { AchievementConstellation as AchievementConstellationType, DiplomaticAchievement } from "~/types/achievement-constellation";
import { ACHIEVEMENT_TEMPLATES, calculatePrestigeScore } from "~/types/achievement-constellation";

interface DiplomaticIntelligenceProfileProps {
  country: EnhancedCountryProfileData;
  viewerCountryId?: string;
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  onSocialAction?: (action: SocialActionType, targetId: string) => void;
}

// Intelligence Classification Levels
const CLASSIFICATION_LEVELS = {
  'PUBLIC': { color: 'text-green-400', bg: 'bg-green-500/20', label: 'PUBLIC' },
  'RESTRICTED': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'RESTRICTED' },
  'CONFIDENTIAL': { color: 'text-red-400', bg: 'bg-red-500/20', label: 'CONFIDENTIAL' }
} as const;

// Intelligence Glyph System
const INTELLIGENCE_GLYPHS = {
  economic: RiBarChartLine,
  diplomatic: RiShakeHandsLine,
  security: RiShieldLine,
  surveillance: RiScanLine,
  intelligence: RiSearchLine,
  communications: RiWifiLine,
  analysis: RiSettings3Line
} as const;

const DiplomaticIntelligenceProfileComponent: React.FC<DiplomaticIntelligenceProfileProps> = ({
  country,
  viewerCountryId,
  viewerClearanceLevel = 'PUBLIC',
  onSocialAction
}) => {
  const [activeIntelSection, setActiveIntelSection] = useState<'command-center' | 'intelligence-dossier' | 'diplomatic-operations' | 'stratcomm-intel' | 'thinkpages-social'>('command-center');
  const [activeDiplomaticTab, setActiveDiplomaticTab] = useState<'networks' | 'channels' | 'cultural' | 'objectives'>('networks');
  const [showDiplomaticActions, setShowDiplomaticActions] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<DiplomaticAchievement | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Calculate intelligence metrics with clearance-based access
  const intelligenceMetrics = useMemo(() => {
    const baseMetrics = {
      economicStrength: Math.min(100, (country.currentGdpPerCapita / 65000) * 100),
      diplomaticReach: Math.min(100, country.socialMetrics.diplomaticRelationships * 8),
      culturalInfluence: Math.min(100, (country.socialMetrics.followers / 50) + 20),
      securityIndex: Math.min(100, 75 + (country.growthStreak * 2)),
      stabilityRating: (() => {
        const tierScores: Record<string, number> = {
          "Extravagant": 95, "Very Strong": 85, "Strong": 75, "Healthy": 65, "Developed": 50, "Developing": 35
        };
        return tierScores[country.economicTier] || 25;
      })(),
    };

    // Apply clearance level restrictions
    if (viewerClearanceLevel === 'PUBLIC') {
      return {
        ...baseMetrics,
        securityIndex: undefined, // Classified
        detailedAnalysis: false
      };
    }

    return { ...baseMetrics, detailedAnalysis: true };
  }, [country, viewerClearanceLevel]);

  // Generate current IxTime intelligence timestamp
  const currentIxTime = useMemo(() => {
    return IxTime.getCurrentIxTime();
  }, []);

  const handleSocialAction = useCallback((action: SocialActionType) => {
    onSocialAction?.(action, country.id);
  }, [onSocialAction, country.id]);

  // Toggle card expansion
  const toggleCard = useCallback((cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }, []);

  // Calculate derived economic metrics
  const economicMetrics = useMemo(() => {
    const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
    const growthRate = country.adjustedGdpGrowth || 0;
    const unemploymentRate = Math.max(2, Math.min(15, 8 - (growthRate * 100))); // Inverse correlation
    
    return {
      economicHealth,
      growthRate,
      unemploymentRate,
      gdpPerCapita: country.currentGdpPerCapita,
      totalGdp: country.currentTotalGdp,
      economicTier: country.economicTier,
      growthTrend: (growthRate > 0.02 ? 'up' : growthRate < -0.01 ? 'down' : 'stable') as 'up' | 'down' | 'stable'
    };
  }, [country]);

  // Calculate demographic metrics
  const demographicMetrics = useMemo(() => {
    const popGrowthRate = country.populationGrowthRate || 0;
    const populationGrowth = Math.min(100, Math.max(0, (popGrowthRate * 100 + 2) * 25));
    const literacyRate = Math.min(99, 70 + (country.currentGdpPerCapita / 1000));
    const lifeExpectancy = Math.min(85, 65 + (country.currentGdpPerCapita / 2000));
    
    return {
      populationGrowth,
      literacyRate,
      lifeExpectancy,
      population: country.currentPopulation,
      populationTier: country.populationTier,
      populationDensity: country.populationDensity,
      landArea: country.landArea,
      growthTrend: (popGrowthRate > 0.01 ? 'up' : popGrowthRate < 0 ? 'down' : 'stable') as 'up' | 'down' | 'stable'
    };
  }, [country]);

  // Calculate development metrics
  const developmentMetrics = useMemo(() => {
    const tierScores: Record<string, number> = {
      "Extravagant": 100, "Very Strong": 85, "Strong": 70,
      "Healthy": 55, "Developed": 40, "Developing": 25
    };
    const developmentIndex = tierScores[country.economicTier] || 10;
    const stabilityRating = Math.min(100, 75 + (country.growthStreak * 2));
    
    return {
      developmentIndex,
      stabilityRating,
      economicTier: country.economicTier,
      growthStreak: country.growthStreak || 0,
      continent: country.continent,
      region: country.region
    };
  }, [country]);

  // Helper function for trend icons
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return RiArrowUpLine;
      case 'down': return RiArrowDownLine;
      default: return RiSubtractLine;
    }
  };

  // Helper function for trend colors
  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Classification Badge Component
  const ClassificationBadge: React.FC<{ level: keyof typeof CLASSIFICATION_LEVELS }> = ({ level }) => {
    const classification = CLASSIFICATION_LEVELS[level];
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
        classification.bg, classification.color,
        "border border-current/20"
      )}>
        <RiLockLine className="h-3 w-3" />
        {classification.label}
      </div>
    );
  };

  // Intelligence Glyph Component
  const IntelligenceGlyph: React.FC<{ type: keyof typeof INTELLIGENCE_GLYPHS; size?: number }> = ({ type, size = 5 }) => {
    const Icon = INTELLIGENCE_GLYPHS[type];
    return <Icon className={`h-${size} w-${size} text-[--intel-gold]`} />;
  };

  return (
    <motion.div
      className="diplomatic-intelligence-profile"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{
        // Intelligence Command Center Styling
        '--intel-navy': '#0F172A',
        '--intel-gold': '#D4AF37', 
        '--intel-silver': '#94A3B8',
        '--intel-amber': '#F59E0B',
        '--intel-glass-blur': 'blur(16px)',
        '--intel-classification-overlay': 'rgba(15, 23, 42, 0.85)',
        '--intel-security-border': '1px solid rgba(212, 175, 55, 0.3)',
      } as React.CSSProperties}
    >
      {/* Intelligence Command Header */}
      <div className="glass-hierarchy-parent rounded-xl overflow-hidden mb-6">
        {/* Classification Header */}
        <div className="relative bg-[--intel-navy] border-b border-[--intel-gold]/20 px-6 py-4 overflow-hidden">
          {/* Flag Background */}
          {country.flagUrl && (
            <div className="absolute inset-0 opacity-10">
              <img 
                src={country.flagUrl} 
                alt={`${country.name} flag`}
                className="w-full h-full object-cover object-center scale-110 blur-[1px]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[--intel-navy]/90 via-[--intel-navy]/70 to-[--intel-navy]/90" />
            </div>
          )}
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <IntelligenceGlyph type="intelligence" size={6} />
                <div>
                  <h1 className="text-2xl font-bold text-[--intel-gold]">
                    {country.name}
                  </h1>
                  <p className="text-[--intel-silver] text-sm">
                     Generated: {IxTime.formatIxTime(currentIxTime, true)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ClassificationBadge level={viewerClearanceLevel} />
              <button
                onClick={() => setShowDiplomaticActions(true)}
                className="flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <RiShakeHandsLine className="h-4 w-4" />
                Diplomatic Actions
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Background with Intelligence Overlay */}
        <div className="relative">
          <div className="absolute inset-0 h-48">
            {country.unsplashImageUrl ? (
              <img
                src={country.unsplashImageUrl}
                alt={`${country.name} intelligence background`}
                className="w-full h-full object-cover"
              />
            ) : country.flagUrl ? (
              <img
                src={country.flagUrl}
                alt={`${country.name} flag`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[--intel-navy] to-[--intel-gold]/20" />
            )}
            {/* Intelligence Classification Overlay */}
            <div className="absolute inset-0 bg-[--intel-classification-overlay]" />
            
            {/* Intelligence Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(212, 175, 55, 0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(212, 175, 55, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}
            />
          </div>

          {/* Country Intelligence Summary */}
          <div className="relative z-10 p-6">
            <div className="flex items-end justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    {/* Country Flag */}
                    {country.flagUrl && (
                      <div className="relative">
                        <img
                          src={country.flagUrl}
                          alt={`${country.name} flag`}
                          className="w-12 h-8 object-cover rounded border-2 border-[--intel-gold]/30 shadow-lg"
                        />
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-[--intel-gold]/50 to-transparent rounded blur-sm -z-10" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <IntelligenceGlyph type="diplomatic" />
                      <span className="text-[--intel-silver] text-sm font-medium">NATION</span>
                    </div>
                  </div>
                  <TextReveal className="text-3xl font-bold text-white">
                    {country.name}
                  </TextReveal>
                </div>
                
                <div className="flex items-center gap-6 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <IntelligenceGlyph type="economic" size={4} />
                    <span className="font-medium">{country.economicTier}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiTeamLine className="h-4 w-4" />
                    <span>{formatPopulation(country.currentPopulation)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiBarChartLine className="h-4 w-4" />
                    <span>{formatCurrency(country.currentGdpPerCapita)}</span>
                  </div>
                  {country.globalRanking && (
                    <div className="flex items-center gap-2">
                      <RiStarLine className="h-4 w-4" />
                      <span>Global Rank #{country.globalRanking}</span>
                    </div>
                  )}
                </div>

                {/* Threat Assessment Indicators */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                    <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
                    <span>Stable</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                    <IntelligenceGlyph type="surveillance" size={3} />
                    <span>Active Monitoring</span>
                  </div>
                  {country.growthStreak > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                      <div className="w-2 h-2 bg-amber-600 dark:bg-amber-400 rounded-full" />
                      <span>{country.growthStreak}Q Growth Trend</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Vitality Metrics Rings */}
              <div className="flex gap-4">
                <div className="text-center">
                  <HealthRing
                    value={Math.min(100, (country.currentGdpPerCapita / 50000) * 100)}
                    size={70}
                    color="rgba(212, 175, 55, 0.8)"
                    label="Economic Power"
                    tooltip={`GDP per capita and economic strength: ${formatCurrency(country.currentGdpPerCapita)}`}
                  />
                  <div className="text-[--intel-gold] text-xs mt-2 font-medium">
                    Economic
                  </div>
                </div>
                <div className="text-center">
                  <HealthRing
                    value={Math.min(100, Math.max(0, (((country.populationGrowthRate ?? 0) * 100) + 2) * 25))}
                    size={70}
                    color="rgba(59, 130, 246, 0.8)"
                    label="Demographics"
                    tooltip={`Population growth and demographic trends: ${formatPopulation(country.currentPopulation)} total`}
                  />
                  <div className="text-blue-400 text-xs mt-2 font-medium">
                    Demographics
                  </div>
                </div>
                <div className="text-center">
                  <HealthRing
                    value={country.economicTier === "Extravagant" ? 100 : 
                           country.economicTier === "Very Strong" ? 85 :
                           country.economicTier === "Strong" ? 70 :
                           country.economicTier === "Healthy" ? 55 :
                           country.economicTier === "Developed" ? 40 :
                           country.economicTier === "Developing" ? 25 : 10}
                    size={70}
                    color="rgba(34, 197, 94, 0.8)"
                    label="Development"
                    tooltip={`Overall development and infrastructure quality: ${country.economicTier} tier`}
                  />
                  <div className="text-green-400 text-xs mt-2 font-medium">
                    Development
                  </div>
                </div>
                <div className="text-center">
                  <HealthRing
                    value={Math.min(100, Math.max(0, ((country.adjustedGdpGrowth ?? 0) * 100 + 3) * 20))}
                    size={70}
                    color="rgba(168, 85, 247, 0.8)"
                    label="Growth Rate"
                    tooltip={`Economic expansion and growth momentum: ${((country.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}% annual growth`}
                  />
                  <div className="text-purple-400 text-xs mt-2 font-medium">
                    Growth
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Intelligence Navigation */}
        <div className="lg:col-span-1">
          <div className="glass-hierarchy-child rounded-lg p-4 space-y-4">
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                {country.flagUrl && (
                  <img
                    src={country.flagUrl}
                    alt={`${country.name} flag`}
                    className="w-8 h-5 object-cover rounded border border-[--intel-gold]/20"
                  />
                )}
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  {country.name} 
                </h3>
              </div>
              <div className="text-xs text-muted-foreground pl-2">
               
              </div>
            </div>

            {/* Enhanced Intelligence Cards */}
            <div className="space-y-3">
              {/* Economic Intelligence Card */}
              <div className="border border-amber-500/20 dark:border-amber-400/20 rounded-lg overflow-hidden bg-gradient-to-br from-amber-500/5 dark:from-amber-400/5 to-transparent">
                <button
                  onClick={() => toggleCard('economic')}
                  className="w-full p-3 text-left hover:bg-amber-500/10 dark:hover:bg-amber-400/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RiMoneyDollarCircleLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Economic Intel</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        {economicMetrics.economicHealth.toFixed(0)}%
                      </div>
                      <motion.div
                        animate={{ rotate: expandedCards.has('economic') ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RiArrowDownLine className="h-3 w-3 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(economicMetrics.gdpPerCapita)}
                    </div>
                    {(() => {
                      const TrendIcon = getTrendIcon(economicMetrics.growthTrend);
                      return (
                        <TrendIcon className={cn("h-3 w-3", getTrendColor(economicMetrics.growthTrend))} />
                      );
                    })()}
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedCards.has('economic') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-amber-500/20 dark:border-amber-400/20 bg-amber-500/5 dark:bg-amber-400/5"
                    >
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <div className="text-muted-foreground">Total GDP</div>
                            <div className="font-medium text-foreground">{formatCurrency(economicMetrics.totalGdp)}</div>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <div className="text-muted-foreground">Growth Rate</div>
                            <div className="font-medium text-foreground">{(economicMetrics.growthRate * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Economic Tier:</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">{economicMetrics.economicTier}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Unemployment Est:</span>
                            <span className="text-foreground">{economicMetrics.unemploymentRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Economic Health:</span>
                            <span className="text-green-600 dark:text-green-400">{economicMetrics.economicHealth.toFixed(0)}%</span>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-amber-500/20 dark:border-amber-400/20">
                          <div className="text-xs text-muted-foreground mb-2">Quick Analysis</div>
                          <div className="text-xs leading-relaxed text-muted-foreground">
                            {economicMetrics.economicHealth > 70 
                              ? "Strong economic fundamentals with healthy GDP per capita and growth trajectory."
                              : economicMetrics.economicHealth > 40
                              ? "Moderate economic performance. Growth opportunities exist with strategic development."
                              : "Developing economy with significant potential for expansion and improvement."
                            }
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Demographic Intelligence Card */}
              <div className="border border-blue-500/20 dark:border-blue-400/20 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/5 dark:from-blue-400/5 to-transparent">
                <button
                  onClick={() => toggleCard('demographic')}
                  className="w-full p-3 text-left hover:bg-blue-500/10 dark:hover:bg-blue-400/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RiTeamLine className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Population Intel</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        Tier {demographicMetrics.populationTier}
                      </div>
                      <motion.div
                        animate={{ rotate: expandedCards.has('demographic') ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RiArrowDownLine className="h-3 w-3 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-muted-foreground">
                      {formatPopulation(demographicMetrics.population)}
                    </div>
                    {(() => {
                      const TrendIcon = getTrendIcon(demographicMetrics.growthTrend);
                      return (
                        <TrendIcon className={cn("h-3 w-3", getTrendColor(demographicMetrics.growthTrend))} />
                      );
                    })()}
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedCards.has('demographic') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-blue-500/20 dark:border-blue-400/20 bg-blue-500/5 dark:bg-blue-400/5"
                    >
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <div className="text-muted-foreground">Growth Rate</div>
                            <div className="font-medium text-foreground">{((country.populationGrowthRate || 0) * 100).toFixed(2)}%</div>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <div className="text-muted-foreground">Life Expect.</div>
                            <div className="font-medium text-foreground">{demographicMetrics.lifeExpectancy.toFixed(0)} yrs</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Literacy Rate:</span>
                            <span className="text-blue-600 dark:text-blue-400">{demographicMetrics.literacyRate.toFixed(1)}%</span>
                          </div>
                          {demographicMetrics.populationDensity && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Density:</span>
                              <span className="text-foreground">{demographicMetrics.populationDensity.toFixed(1)}/km²</span>
                            </div>
                          )}
                          {demographicMetrics.landArea && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Land Area:</span>
                              <span className="text-foreground">{demographicMetrics.landArea.toLocaleString()} km²</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="pt-2 border-t border-blue-500/20 dark:border-blue-400/20">
                          <div className="text-xs text-muted-foreground mb-2">Demographic Profile</div>
                          <div className="text-xs leading-relaxed text-muted-foreground">
                            {demographicMetrics.populationGrowth > 70
                              ? "Robust population growth indicating strong social stability and economic opportunities."
                              : demographicMetrics.populationGrowth > 40
                              ? "Moderate demographic trends with balanced population dynamics."
                              : "Stable or declining population growth, typical of developed nations."
                            }
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Development Intelligence Card */}
              <div className="border border-purple-500/20 dark:border-purple-400/20 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500/5 dark:from-purple-400/5 to-transparent">
                <button
                  onClick={() => toggleCard('development')}
                  className="w-full p-3 text-left hover:bg-purple-500/10 dark:hover:bg-purple-400/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RiBarChartLine className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Development Intel</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        {developmentMetrics.developmentIndex}%
                      </div>
                      <motion.div
                        animate={{ rotate: expandedCards.has('development') ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RiArrowDownLine className="h-3 w-3 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-muted-foreground">
                      {developmentMetrics.economicTier}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      {developmentMetrics.growthStreak}Q Streak
                    </div>
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedCards.has('development') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-purple-500/20 dark:border-purple-400/20 bg-purple-500/5 dark:bg-purple-400/5"
                    >
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <div className="text-muted-foreground">Dev. Index</div>
                            <div className="font-medium text-foreground">{developmentMetrics.developmentIndex}%</div>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <div className="text-muted-foreground">Stability</div>
                            <div className="font-medium text-foreground">{developmentMetrics.stabilityRating.toFixed(0)}%</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Economic Tier:</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium">{developmentMetrics.economicTier}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Growth Streak:</span>
                            <span className="text-green-600 dark:text-green-400">{developmentMetrics.growthStreak} Quarters</span>
                          </div>
                          {developmentMetrics.continent && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Region:</span>
                              <span className="text-foreground">{developmentMetrics.region || developmentMetrics.continent}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="pt-2 border-t border-purple-500/20 dark:border-purple-400/20">
                          <div className="text-xs text-muted-foreground mb-2">Development Assessment</div>
                          <div className="text-xs leading-relaxed text-muted-foreground">
                            {developmentMetrics.developmentIndex > 80
                              ? "Highly developed nation with advanced infrastructure and strong institutional frameworks."
                              : developmentMetrics.developmentIndex > 50
                              ? "Well-developed country with solid economic foundations and growing capabilities."
                              : "Developing nation with significant potential for growth and modernization."
                            }
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Section Navigation */}
            <div className="pt-4 border-t border-amber-500/20 dark:border-amber-400/20">
              <div className="text-xs text-muted-foreground mb-3 font-medium">INTELLIGENCE SECTIONS</div>
              <div className="space-y-1">
                {[
                  { id: 'command-center', label: 'Strategic Assessment', icon: RiShieldLine, clearance: 'PUBLIC' },
                  { id: 'intelligence-dossier', label: 'Intelligence Dossier', icon: RiFileTextLine, clearance: 'PUBLIC' },
                  { id: 'diplomatic-operations', label: 'Diplomatic Operations', icon: RiShakeHandsLine, clearance: 'PUBLIC' },
                  { id: 'stratcomm-intel', label: 'StratComm Intelligence', icon: RiWifiLine, clearance: 'PUBLIC' },
                  { id: 'thinkpages-social', label: 'Thinkpages Social', icon: RiTeamLine, clearance: 'PUBLIC' }
                ].map(section => {
                  const isRestricted = viewerClearanceLevel === 'PUBLIC' && section.clearance !== 'PUBLIC';
                  const isActive = activeIntelSection === section.id;
                  
                  return (
                    <button
                      key={section.id}
                      onClick={() => !isRestricted && setActiveIntelSection(section.id as any)}
                      disabled={isRestricted}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left",
                        isActive && !isRestricted && "bg-amber-500/20 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300",
                        !isActive && !isRestricted && "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        isRestricted && "text-muted-foreground/40 cursor-not-allowed"
                      )}
                    >
                      <section.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">{section.label}</span>
                      {isRestricted && (
                        <RiLockLine className="h-3 w-3 text-red-500 dark:text-red-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-hierarchy-child rounded-lg p-4 mt-4">
            <h3 className="text-sm font-semibold text-[--intel-gold] mb-3 flex items-center gap-2">
              <RiShakeHandsLine className="h-4 w-4" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => handleSocialAction('follow')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
              >
                <RiUserAddLine className="h-4 w-4" />
                Follow Nation
              </button>
              <button
                onClick={() => handleSocialAction('message')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
              >
                <RiChat3Line className="h-4 w-4" />
                Secure Message
              </button>
              <button
                onClick={() => window.location.href = `/countries/${country.id}`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] rounded-lg transition-colors"
              >
                <RiMapPinLine className="h-4 w-4" />
                Open IxMaps
              </button>
              <button
                onClick={() => window.location.href = `/countries/${country.id}`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] rounded-lg transition-colors"
              >
                <RiExternalLinkLine className="h-4 w-4" />
                Read Wiki
              </button>
            </div>
          </div>
        </div>

        {/* Intelligence Content */}
        <div className="lg:col-span-3">
          <div className="glass-hierarchy-child rounded-lg p-6">
            <AnimatePresence mode="wait">
              {activeIntelSection === 'command-center' && (
                <motion.div
                  key="enhanced-briefing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Enhanced Intelligence Briefing with Live Intelligence Integration */}
                  <EnhancedIntelligenceBriefing
                    country={{
                      id: country.id,
                      name: country.name,
                      continent: country.continent,
                      region: country.region,
                      governmentType: country.governmentType,
                      leader: country.leader,
                      religion: country.religion,
                      capital: country.capital,
                      currentPopulation: country.currentPopulation,
                      currentGdpPerCapita: country.currentGdpPerCapita,
                      currentTotalGdp: country.currentTotalGdp,
                      economicTier: country.economicTier,
                      populationTier: country.populationTier,
                      populationGrowthRate: country.populationGrowthRate || 0.01,
                      adjustedGdpGrowth: country.adjustedGdpGrowth || 0.02,
                      populationDensity: country.populationDensity,
                      landArea: country.landArea,
                      lastCalculated: typeof country.lastCalculated === 'string' ? new Date(country.lastCalculated).getTime() : (country.lastCalculated || Date.now()),
                      baselineDate: typeof country.baselineDate === 'string' ? new Date(country.baselineDate).getTime() : (country.baselineDate || Date.now())
                    }}
                    currentIxTime={IxTime.getCurrentIxTime()}
                    viewerClearanceLevel={viewerClearanceLevel}
                    isOwnCountry={viewerCountryId === country.id}
                    flagColors={{
                      primary: '#d4af37',
                      secondary: '#b8860b', 
                      accent: '#ffd700'
                    }}
                  />
                  

                  {/* Real-time Achievement Notifications */}
                  <RealTimeAchievementNotifications
                    countryId={country.id}
                    countryName={country.name}
                  />
                </motion.div>
              )}

              {activeIntelSection === 'intelligence-dossier' && (
                <motion.div
                  key="wiki"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <WikiIntelligenceTab
                    countryName={country.name}
                    countryData={{
                      currentPopulation: country.currentPopulation,
                      currentGdpPerCapita: country.currentGdpPerCapita,
                      currentTotalGdp: country.currentTotalGdp,
                      economicTier: country.economicTier,
                      continent: country.continent,
                      region: country.region,
                      governmentType: country.governmentType,
                      leader: country.leader,
                      capital: country.capital,
                      religion: country.religion
                    }}
                    viewerClearanceLevel={viewerClearanceLevel}
                    flagColors={{
                      primary: '#d4af37',
                      secondary: '#b8860b', 
                      accent: '#ffd700'
                    }}
                  />
                </motion.div>
              )}

              {/* Removed Classic Briefing - redundant with Enhanced Intelligence */ false && (
                <motion.div
                  key="briefing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
                      <IntelligenceGlyph type="intelligence" />
                      Executive Intelligence Briefing
                    </h2>
                    <div className="flex items-center gap-2 text-[--intel-silver] text-sm">
                      <RiRefreshLine className="h-4 w-4" />
                      Last Updated: {IxTime.formatIxTime(currentIxTime, true)}
                    </div>
                  </div>

                  {/* Key Intelligence Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <IntelligenceGlyph type="economic" size={5} />
                        Economic Intelligence
                      </h3>
                      <div className="space-y-3 pl-7">
                        <div className="flex justify-between">
                          <span className="text-[--intel-silver]">Total GDP</span>
                          <span className="font-semibold text-[--intel-gold]">
                            {formatCurrency(country.currentTotalGdp)}
                          </span>
                        </div>
                        {country.adjustedGdpGrowth !== undefined && country.adjustedGdpGrowth !== null && (
                          <div className="flex justify-between">
                            <span className="text-[--intel-silver]">Growth Trajectory</span>
                            <span className="font-semibold text-green-400">
                              {(country.adjustedGdpGrowth! * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[--intel-silver]">Economic Classification</span>
                          <span className="font-semibold text-white">
                            {country.economicTier}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <IntelligenceGlyph type="diplomatic" size={5} />
                        Diplomatic Intelligence
                      </h3>
                      <div className="space-y-3 pl-7">
                        <div className="flex justify-between">
                          <span className="text-[--intel-silver]">Active Relations</span>
                          <span className="font-semibold text-blue-400">
                            {country.socialMetrics.diplomaticRelationships}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[--intel-silver]">International Followers</span>
                          <span className="font-semibold text-purple-400">
                            {country.socialMetrics.followers}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[--intel-silver]">Recent Engagement</span>
                          <span className="font-semibold text-green-400">
                            {country.socialMetrics.recentVisitors} visits
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Intelligence Highlights */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <RiNotification3Line className="h-5 w-5 text-[--intel-amber]" />
                      Recent Intelligence Highlights
                    </h3>
                    <div className="space-y-3">
                      {country.achievementConstellation?.recentMilestones?.slice(0, 3).map((achievement, index) => (
                        <div key={achievement.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-[--intel-gold]/20">
                          <div className="w-2 h-2 bg-[--intel-gold] rounded-full" />
                          <div className="flex-1">
                            <p className="text-white font-medium">{achievement.title}</p>
                            <p className="text-[--intel-silver] text-sm">Achieved {achievement.achievedAt}</p>
                          </div>
                          <div className="text-[--intel-gold] text-sm font-medium">
                            +{achievement.socialReactions?.length || 0} recognition
                          </div>
                        </div>
                      ))}
                      {(!country.achievementConstellation?.recentMilestones || country.achievementConstellation.recentMilestones.length === 0) && (
                        <div className="text-center py-8 text-[--intel-silver]">
                          <IntelligenceGlyph type="surveillance" size={8} />
                          <p className="mt-2">No recent intelligence highlights</p>
                          <p className="text-sm">Monitoring for developments...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeIntelSection === 'diplomatic-operations' && (
                <motion.div
                  key="diplomatic-operations"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Diplomatic Operations Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
                      <RiShakeHandsLine className="h-5 w-5" />
                      Diplomatic Operations Center
                    </h2>
                    <div className="flex items-center gap-2 text-[--intel-silver] text-sm">
                      <IntelligenceGlyph type="diplomatic" size={4} />
                      <span>Active Operations: {country.diplomaticRelations?.length || 0}</span>
                    </div>
                  </div>

                  {/* Diplomatic Operations Tabs */}
                  <div className="bg-white/5 rounded-lg border border-white/10">
                    <div className="flex border-b border-white/10">
                      <button
                        onClick={() => setActiveDiplomaticTab('networks')}
                        className={cn(
                          "flex-1 py-3 px-4 text-sm font-medium transition-colors",
                          activeDiplomaticTab === 'networks'
                            ? "text-[--intel-gold] bg-[--intel-gold]/10 border-b-2 border-[--intel-gold]"
                            : "text-[--intel-silver] hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <RiGlobalLine className="h-4 w-4" />
                          Embassy Network
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveDiplomaticTab('channels')}
                        className={cn(
                          "flex-1 py-3 px-4 text-sm font-medium transition-colors",
                          activeDiplomaticTab === 'channels'
                            ? "text-[--intel-gold] bg-[--intel-gold]/10 border-b-2 border-[--intel-gold]"
                            : "text-[--intel-silver] hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <RiLockLine className="h-4 w-4" />
                          Secure Channels
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveDiplomaticTab('cultural')}
                        className={cn(
                          "flex-1 py-3 px-4 text-sm font-medium transition-colors",
                          activeDiplomaticTab === 'cultural'
                            ? "text-[--intel-gold] bg-[--intel-gold]/10 border-b-2 border-[--intel-gold]"
                            : "text-[--intel-silver] hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <RiGlobalLine className="h-4 w-4" />
                          Cultural Programs
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveDiplomaticTab('objectives')}
                        className={cn(
                          "flex-1 py-3 px-4 text-sm font-medium transition-colors",
                          activeDiplomaticTab === 'objectives'
                            ? "text-[--intel-gold] bg-[--intel-gold]/10 border-b-2 border-[--intel-gold]"
                            : "text-[--intel-silver] hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <RiStarLine className="h-4 w-4" />
                          Strategic Objectives
                        </div>
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      <AnimatePresence mode="wait">
                        {activeDiplomaticTab === 'networks' && (
                          <motion.div
                            key="networks"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            <EmbassyNetworkVisualization
                              primaryCountry={{
                                id: country.id,
                                name: country.name,
                                flagUrl: country.flagUrl,
                                economicTier: country.economicTier
                              }}
                              diplomaticRelations={country.diplomaticRelations?.map(relation => ({
                                id: relation.id,
                                countryId: relation.countryId || relation.id,
                                countryName: relation.countryName,
                                relationType: relation.relationType,
                                strength: relation.strength || relation.relationshipStrength,
                                recentActivity: relation.recentActivity?.[0]?.title || 'No recent activity',
                                establishedAt: relation.establishedAt || relation.establishedDate,
                                economicTier: 'Unknown' // Could be enhanced with actual data
                              })) || []}
                              onRelationClick={(relation) => {
                                // Navigate to country profile or show more details
                                console.log('Viewing relation:', relation);
                              }}
                              onEstablishEmbassy={(targetCountryId) => {
                                // Handle embassy establishment
                                console.log('Establishing embassy with:', targetCountryId);
                              }}
                              viewerClearanceLevel={viewerClearanceLevel}
                            />
                          </motion.div>
                        )}

                        {activeDiplomaticTab === 'channels' && (
                          <motion.div
                            key="channels"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            {viewerClearanceLevel !== 'PUBLIC' ? (
                              <SecureDiplomaticChannels
                                currentCountryId={country.id}
                                currentCountryName={country.name}
                                channels={[
                                  {
                                    id: 'bilateral-001',
                                    name: `${country.name} Embassy Channel`,
                                    type: 'BILATERAL' as const,
                                    classification: 'RESTRICTED' as const,
                                    encrypted: true,
                                    participants: [{
                                      countryId: country.id,
                                      countryName: country.name,
                                      flagUrl: country.flagUrl,
                                      role: 'MEMBER' as const
                                    }],
                                    lastActivity: new Date().toISOString(),
                                    unreadCount: 0
                                  }
                                ]}
                                messages={[]}
                              />
                            ) : (
                              <div className="text-center py-12">
                                <RiLockLine className="h-16 w-16 text-red-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-red-400 mb-2">
                                  Restricted Access
                                </h3>
                                <p className="text-[--intel-silver]">
                                  RESTRICTED clearance required to access secure diplomatic channels.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {activeDiplomaticTab === 'cultural' && (
                          <motion.div
                            key="cultural"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CulturalExchangeProgram
                              primaryCountry={{
                                id: country.id,
                                name: country.name,
                                flagUrl: country.flagUrl,
                                economicTier: country.economicTier
                              }}
                              exchanges={[]}
                            />
                          </motion.div>
                        )}

                        {activeDiplomaticTab === 'objectives' && (
                          <motion.div
                            key="objectives"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-8"
                          >
                            {/* Achievement Constellation */}
                            <div>
                              <h4 className="text-lg font-semibold text-[--intel-gold] flex items-center gap-3 mb-4">
                                <RiStarLine className="h-5 w-5" />
                                Achievement Constellation
                              </h4>
                              <AchievementConstellation
                                constellation={{
                                  id: `constellation-${country.id}`,
                                  countryId: country.id,
                                  constellationName: `${country.name} Diplomatic Legacy`,
                                  totalAchievements: ACHIEVEMENT_TEMPLATES.length,
                                  prestigeScore: calculatePrestigeScore(
                                    ACHIEVEMENT_TEMPLATES.map((template, index) => ({
                                      ...template,
                                      id: template.id || `achievement-${index}`,
                                      achievedAt: new Date().toISOString(),
                                      ixTimeContext: Date.now(),
                                      requirements: template.requirements || [],
                                      rewards: template.rewards || [],
                                      socialReactions: Math.floor(Math.random() * 50),
                                      constellationPosition: {
                                        x: 400 + Math.cos(index * 0.5) * 150,
                                        y: 300 + Math.sin(index * 0.5) * 150,
                                        brightness: 0.8,
                                        size: 16,
                                        layer: 1
                                      },
                                      progress: { percentage: 100, currentStep: 1, totalSteps: 1 },
                                      tier: template.tier || 'bronze',
                                      rarity: template.rarity || 'common',
                                      title: template.title || 'Unknown Achievement',
                                      description: template.description || 'Achievement description',
                                      category: template.category || 'diplomatic'
                                    } as DiplomaticAchievement))
                                  ),
                                  achievements: ACHIEVEMENT_TEMPLATES.map((template, index) => ({
                                    ...template,
                                    id: template.id || `achievement-${index}`,
                                    achievedAt: new Date().toISOString(),
                                    ixTimeContext: Date.now(),
                                    requirements: template.requirements || [],
                                    rewards: template.rewards || [],
                                    socialReactions: Math.floor(Math.random() * 50),
                                    constellationPosition: {
                                      x: 400 + Math.cos(index * 0.5) * 150,
                                      y: 300 + Math.sin(index * 0.5) * 150,
                                      brightness: 0.8,
                                      size: 16,
                                      layer: 1
                                    },
                                    progress: { percentage: 100, currentStep: 1, totalSteps: 1 },
                                    tier: template.tier || 'bronze',
                                    rarity: template.rarity || 'common',
                                    title: template.title || 'Unknown Achievement',
                                    description: template.description || 'Achievement description',
                                    category: template.category || 'diplomatic'
                                  } as DiplomaticAchievement)),
                                  visualLayout: {
                                    centerX: 400,
                                    centerY: 300,
                                    radius: 200,
                                    rotation: 0,
                                    theme: 'classic_gold' as const
                                  },
                                  socialMetrics: {
                                    totalViews: 1250,
                                    socialShares: 45,
                                    admirers: 23,
                                    influenceScore: 850,
                                    trendingAchievements: []
                                  },
                                  lastUpdated: new Date().toISOString(),
                                  ixTimeContext: Date.now()
                                }}
                                onAchievementClick={setSelectedAchievement}
                              />
                            </div>
                            
                            {/* Diplomatic Leaderboards */}
                            <div>
                              <h4 className="text-lg font-semibold text-[--intel-gold] flex items-center gap-3 mb-4">
                                <RiBarChartLine className="h-5 w-5" />
                                Diplomatic Rankings
                              </h4>
                              <DiplomaticLeaderboards
                                viewerCountryId={country.id}
                                viewerClearanceLevel={viewerClearanceLevel}
                                compact={false}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}


              {activeIntelSection === 'stratcomm-intel' && (
                <motion.div
                  key="stratcomm-intel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
                      <RiWifiLine className="h-5 w-5" />
                      StratComm Intelligence
                      <span className="text-xs bg-[--intel-gold]/20 text-[--intel-gold] px-2 py-1 rounded-full">
                        LIVE
                      </span>
                    </h2>
                    <div className="text-sm text-[--intel-silver]">
                      Professional Intelligence System
                    </div>
                  </div>

                  {/* Intelligence Feed Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <RiWifiLine className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">Diplomatic Events</span>
                      </div>
                      <div className="text-lg font-bold text-white mb-1">24</div>
                      <div className="text-xs text-[--intel-silver]">Active this week</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <RiNotification3Line className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium text-purple-400">Social Activities</span>
                      </div>
                      <div className="text-lg font-bold text-white mb-1">12</div>
                      <div className="text-xs text-[--intel-silver]">Recent interactions</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <RiStarLine className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-green-400">Achievements</span>
                      </div>
                      <div className="text-lg font-bold text-white mb-1">3</div>
                      <div className="text-xs text-[--intel-silver]">Recent unlocks</div>
                    </div>
                  </div>

                  {/* Professional Intelligence Interface */}
                  <div className="bg-white/5 rounded-lg border border-white/10">
                    <div className="flex border-b border-white/10">
                      <button className="flex-1 py-3 px-4 text-sm font-medium text-[--intel-gold] bg-[--intel-gold]/10 border-b-2 border-[--intel-gold]">
                        All Events
                      </button>
                      <button className="flex-1 py-3 px-4 text-sm font-medium text-[--intel-silver] hover:text-white">
                        Diplomatic
                      </button>
                      <button className="flex-1 py-3 px-4 text-sm font-medium text-[--intel-silver] hover:text-white">
                        Security
                      </button>
                      <button className="flex-1 py-3 px-4 text-sm font-medium text-[--intel-silver] hover:text-white">
                        Economic
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {/* Live Diplomatic Feed */}
                      <div>
                        <h4 className="text-sm font-semibold text-[--intel-gold] mb-4 flex items-center gap-2">
                          <RiWifiLine className="h-4 w-4" />
                          Diplomatic Intelligence
                        </h4>
                        <LiveDiplomaticFeed
                          countryId={country.id}
                          countryName={country.name}
                          clearanceLevel={viewerClearanceLevel}
                          maxEvents={25}
                          autoRefresh={true}
                          showConnectionStatus={true}
                          compact={false}
                        />
                      </div>
                      
                      {/* Social Activity Feed */}
                      <div>
                        <h4 className="text-sm font-semibold text-[--intel-gold] mb-4 flex items-center gap-2">
                          <RiNotification3Line className="h-4 w-4" />
                          Social Activity Intelligence
                        </h4>
                        <SocialActivityFeed
                          countryId={country.id}
                          feedType="country"
                          compact={false}
                          maxItems={25}
                          showInteractions={true}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeIntelSection === 'thinkpages-social' && (
                <motion.div
                  key="thinkpages-social"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <ThinkpagesSocialPlatform
                    countryId={country.id}
                    countryName={country.name}
                    isOwner={viewerCountryId === country.id}
                  />
                </motion.div>
              )}

              {/* Clearance Restriction Display */}
              {((activeIntelSection === 'diplomatic-operations' && viewerClearanceLevel === 'PUBLIC') ||
                (activeIntelSection === 'command-center' && viewerClearanceLevel === 'PUBLIC') ||
                (activeIntelSection === 'intelligence-dossier' && viewerClearanceLevel !== 'CONFIDENTIAL')) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <RiLockLine className="h-16 w-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-red-400 mb-2">
                    Insufficient Clearance Level
                  </h3>
                  <p className="text-[--intel-silver] mb-4">
                    {activeIntelSection === 'command-center' || activeIntelSection === 'diplomatic-operations' ? 'RESTRICTED' : 'CONFIDENTIAL'} clearance required to access this intelligence section.
                  </p>
                  <ClassificationBadge level={viewerClearanceLevel} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Diplomatic Actions Dynamic Island */}
      <AnimatePresence>
        {showDiplomaticActions && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDiplomaticActions(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <DynamicIslandProvider initialSize={SIZE_PRESETS.ULTRA}>
              <DynamicIsland id="diplomatic-actions">
                <DynamicContainer className="p-4 w-full h-full flex flex-col">
                  <DynamicTitle className="text-lg font-bold text-[--intel-gold] flex items-center gap-3 mb-3 flex-shrink-0">
                    <IntelligenceGlyph type="diplomatic" />
                    Diplomatic Actions
                  </DynamicTitle>
                  
                  <DynamicDiv className="flex-1 overflow-y-auto space-y-2">
                    {[
                      { action: 'follow', icon: RiUserAddLine, label: 'Follow Nation', desc: 'Monitor developments', color: 'text-blue-400' },
                      { action: 'message', icon: RiChat3Line, label: 'Diplomatic Message', desc: 'Secure correspondence', color: 'text-purple-400' },
                      { action: 'propose', icon: RiShakeHandsLine, label: 'Alliance Proposal', desc: 'Formal proposal', color: 'text-green-400' },
                      { action: 'congratulate', icon: RiStarLine, label: 'Congratulate', desc: 'Recognize achievements', color: 'text-[--intel-gold]' }
                    ].map(actionItem => (
                      <button
                        key={actionItem.action}
                        onClick={() => {
                          handleSocialAction(actionItem.action as SocialActionType);
                          setShowDiplomaticActions(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/15 rounded-lg transition-colors text-left border border-white/10"
                      >
                        <actionItem.icon className={cn("h-4 w-4", actionItem.color)} />
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">{actionItem.label}</div>
                          <div className="text-xs text-[--intel-silver]">{actionItem.desc}</div>
                        </div>
                      </button>
                    ))}
                  </DynamicDiv>
                  
                  <button
                    onClick={() => setShowDiplomaticActions(false)}
                    className="absolute top-2 right-2 text-[--intel-silver] hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </DynamicContainer>
              </DynamicIsland>
            </DynamicIslandProvider>
          </div>
        )}
      </AnimatePresence>

      {/* Achievement Unlock Modal */}
      <AchievementUnlockModal
        achievement={selectedAchievement}
        visible={showUnlockModal}
        onClose={() => {
          setShowUnlockModal(false);
          setSelectedAchievement(null);
        }}
        onShare={(achievementId) => {
          console.log('Sharing achievement:', achievementId);
          // Could integrate with social sharing
        }}
        onViewProgress={(achievementId) => {
          console.log('Viewing achievement progress:', achievementId);
          // Could navigate to achievement progress page
        }}
        autoCloseDelay={6000}
      />

      {/* Real-Time Achievement Notifications */}
      <RealTimeAchievementNotifications
        countryId={country.id}
        countryName={country.name}
        position="top-right"
        maxNotifications={3}
        autoHideDuration={6000}
        showParticleEffects={true}
        playSound={true}
      />
    </motion.div>
  );
};

DiplomaticIntelligenceProfileComponent.displayName = 'DiplomaticIntelligenceProfile';

export const DiplomaticIntelligenceProfile = React.memo(DiplomaticIntelligenceProfileComponent);