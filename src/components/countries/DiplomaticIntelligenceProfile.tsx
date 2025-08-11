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
  RiSettings3Line
} from "react-icons/ri";

import type { EnhancedCountryProfileData, SocialActionType } from "~/types/social-profile";
import { EmbassyNetworkVisualization } from "~/components/diplomatic/EmbassyNetworkVisualization";
import { SecureDiplomaticChannels } from "~/components/diplomatic/SecureDiplomaticChannels";
import { CulturalExchangeProgram } from "~/components/diplomatic/CulturalExchangeProgram";
import { AchievementConstellation } from "~/components/achievements/AchievementConstellation";
import { AchievementUnlockModal } from "~/components/achievements/AchievementUnlockModal";
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
  const [activeIntelSection, setActiveIntelSection] = useState<'briefing' | 'network' | 'channels' | 'cultural' | 'achievements' | 'activity' | 'assessment'>('briefing');
  const [showDiplomaticActions, setShowDiplomaticActions] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<DiplomaticAchievement | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

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
        <div className="bg-[--intel-navy] border-b border-[--intel-gold]/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <IntelligenceGlyph type="intelligence" size={6} />
                <div>
                  <h1 className="text-xl font-bold text-[--intel-gold]">
                    DIPLOMATIC INTELLIGENCE PROFILE
                  </h1>
                  <p className="text-[--intel-silver] text-sm">
                    Subject: {country.name} • Generated: {IxTime.formatIxTime(currentIxTime, true)}
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
                  <div className="flex items-center gap-2">
                    <IntelligenceGlyph type="diplomatic" />
                    <span className="text-[--intel-silver] text-sm font-medium">NATION</span>
                  </div>
                  <TextReveal className="text-3xl font-bold text-white">
                    {country.name}
                  </TextReveal>
                </div>
                
                <div className="flex items-center gap-6 text-[--intel-gold]">
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
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span>Stable</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 text-sm">
                    <IntelligenceGlyph type="surveillance" size={3} />
                    <span>Active Monitoring</span>
                  </div>
                  {country.growthStreak > 0 && (
                    <div className="flex items-center gap-2 text-[--intel-amber] text-sm">
                      <div className="w-2 h-2 bg-[--intel-amber] rounded-full" />
                      <span>{country.growthStreak}Q Growth Trend</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Intelligence Metrics Rings */}
              <div className="flex gap-4">
                <div className="text-center">
                  <HealthRing
                    value={intelligenceMetrics.economicStrength}
                    size={70}
                    color="rgba(212, 175, 55, 0.8)"
                    label=""
                  />
                  <div className="text-[--intel-gold] text-xs mt-2 font-medium">
                    Economic
                  </div>
                </div>
                <div className="text-center">
                  <HealthRing
                    value={intelligenceMetrics.diplomaticReach}
                    size={70}
                    color="rgba(59, 130, 246, 0.8)"
                    label=""
                  />
                  <div className="text-blue-400 text-xs mt-2 font-medium">
                    Diplomatic
                  </div>
                </div>
                <div className="text-center">
                  <HealthRing
                    value={intelligenceMetrics.stabilityRating}
                    size={70}
                    color="rgba(34, 197, 94, 0.8)"
                    label=""
                  />
                  <div className="text-green-400 text-xs mt-2 font-medium">
                    Stability
                  </div>
                </div>
                {intelligenceMetrics.securityIndex && (
                  <div className="text-center">
                    <HealthRing
                      value={intelligenceMetrics.securityIndex}
                      size={70}
                      color="rgba(239, 68, 68, 0.8)"
                      label=""
                    />
                    <div className="text-red-400 text-xs mt-2 font-medium">
                      Security
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Intelligence Navigation */}
        <div className="lg:col-span-1">
          <div className="glass-hierarchy-child rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-[--intel-gold] mb-4 flex items-center gap-2">
              <IntelligenceGlyph type="analysis" size={4} />
              Intelligence Sections
            </h3>
            {[
              { id: 'briefing', label: 'Executive Briefing', icon: RiFileTextLine, clearance: 'PUBLIC' },
              { id: 'network', label: 'Diplomatic Network', icon: RiShakeHandsLine, clearance: 'PUBLIC' },
              { id: 'channels', label: 'Secure Channels', icon: RiLockLine, clearance: 'RESTRICTED' },
              { id: 'cultural', label: 'Cultural Exchange', icon: RiGlobalLine, clearance: 'PUBLIC' },
              { id: 'achievements', label: 'Achievement Constellation', icon: RiStarLine, clearance: 'PUBLIC' },
              { id: 'activity', label: 'Activity Intelligence', icon: RiNotification3Line, clearance: 'RESTRICTED' },
              { id: 'assessment', label: 'Strategic Assessment', icon: RiSettings3Line, clearance: 'CONFIDENTIAL' }
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
                    isActive && !isRestricted && "bg-[--intel-gold]/20 text-[--intel-gold]",
                    !isActive && !isRestricted && "text-[--intel-silver] hover:text-white hover:bg-white/5",
                    isRestricted && "text-[--intel-silver]/40 cursor-not-allowed"
                  )}
                >
                  <section.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{section.label}</span>
                  {isRestricted && (
                    <RiLockLine className="h-3 w-3 text-red-400" />
                  )}
                </button>
              );
            })}
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
                Diplomatic Message
              </button>
              <button
                onClick={() => window.location.href = `/countries/${country.id}`}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] rounded-lg transition-colors"
              >
                <RiExternalLinkLine className="h-4 w-4" />
                Full Country Profile
              </button>
            </div>
          </div>
        </div>

        {/* Intelligence Content */}
        <div className="lg:col-span-3">
          <div className="glass-hierarchy-child rounded-lg p-6">
            <AnimatePresence mode="wait">
              {activeIntelSection === 'briefing' && (
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
                        {country.adjustedGdpGrowth && (
                          <div className="flex justify-between">
                            <span className="text-[--intel-silver]">Growth Trajectory</span>
                            <span className="font-semibold text-green-400">
                              {(country.adjustedGdpGrowth * 100).toFixed(1)}%
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
                            +{achievement.socialReactions} recognition
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

              {activeIntelSection === 'network' && (
                <motion.div
                  key="network"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
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
                      strength: relation.strength,
                      recentActivity: relation.recentActivity,
                      establishedAt: relation.establishedAt || new Date().toISOString(),
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

              {activeIntelSection === 'channels' && viewerClearanceLevel !== 'PUBLIC' && (
                <motion.div
                  key="channels"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <SecureDiplomaticChannels
                    currentCountryId={country.id}
                    currentCountryName={country.name}
                    channels={[
                      {
                        id: 'bilateral-001',
                        name: `${country.name} Embassy Channel`,
                        type: 'BILATERAL' as const,
                        participants: [
                          {
                            countryId: country.id,
                            countryName: country.name,
                            flagUrl: country.flagUrl,
                            role: 'MEMBER' as const
                          }
                        ],
                        classification: 'RESTRICTED' as const,
                        encrypted: true,
                        lastActivity: new Date().toISOString(),
                        unreadCount: 0
                      }
                    ]}
                    messages={[]}
                    viewerClearanceLevel={viewerClearanceLevel}
                    onSendMessage={(channelId, message) => {
                      console.log('Sending diplomatic message:', { channelId, message });
                    }}
                    onCreateChannel={(channelData) => {
                      console.log('Creating diplomatic channel:', channelData);
                    }}
                    onJoinChannel={(channelId) => {
                      console.log('Joining diplomatic channel:', channelId);
                    }}
                  />
                </motion.div>
              )}

              {activeIntelSection === 'cultural' && (
                <motion.div
                  key="cultural"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <CulturalExchangeProgram
                    primaryCountry={{
                      id: country.id,
                      name: country.name,
                      flagUrl: country.flagUrl,
                      economicTier: country.economicTier
                    }}
                    exchanges={[
                      {
                        id: 'exchange-001',
                        title: `${country.name} Cultural Festival 2024`,
                        type: 'festival' as const,
                        description: `Annual celebration showcasing ${country.name}'s rich cultural heritage, traditions, and contemporary arts.`,
                        hostCountry: {
                          id: country.id,
                          name: country.name,
                          flagUrl: country.flagUrl
                        },
                        participatingCountries: [
                          {
                            id: 'demo-001',
                            name: 'Demo Partner Nation',
                            role: 'participant' as const
                          }
                        ],
                        status: 'active' as const,
                        startDate: new Date().toISOString(),
                        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        ixTimeContext: IxTime.getCurrentIxTime(),
                        metrics: {
                          participants: 150,
                          culturalImpact: 78,
                          diplomaticValue: 65,
                          socialEngagement: 92
                        },
                        achievements: [
                          'First successful multicultural festival',
                          'Record international participation'
                        ],
                        culturalArtifacts: [
                          {
                            id: 'artifact-001',
                            type: 'photo' as const,
                            title: 'Festival Opening Ceremony',
                            contributor: country.name,
                            countryId: country.id
                          }
                        ],
                        diplomaticOutcomes: {
                          newPartnerships: 3,
                          tradeAgreements: 1,
                          futureCollaborations: [
                            'Annual cultural exchange program',
                            'Student exchange initiative'
                          ]
                        }
                      }
                    ]}
                    onCreateExchange={(exchangeData) => {
                      console.log('Creating cultural exchange:', exchangeData);
                    }}
                    onJoinExchange={(exchangeId, role) => {
                      console.log('Joining cultural exchange:', { exchangeId, role });
                    }}
                    onViewArtifact={(artifactId) => {
                      console.log('Viewing cultural artifact:', artifactId);
                    }}
                    viewerClearanceLevel={viewerClearanceLevel}
                  />
                </motion.div>
              )}

              {activeIntelSection === 'achievements' && (
                <motion.div
                  key="achievements"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
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
                          title: template.title || 'Unknown Achievement',
                          description: template.description || 'Achievement description',
                          category: template.category || 'diplomatic',
                          tier: template.tier || 'bronze',
                          rarity: template.rarity || 'common',
                          achievedAt: index < 3 ? new Date().toISOString() : '', // First 3 achievements unlocked
                          ixTimeContext: IxTime.getCurrentIxTime(),
                          requirements: template.requirements || [],
                          rewards: template.rewards || [],
                          socialReactions: Math.floor(Math.random() * 50),
                          constellationPosition: { x: 0, y: 0, brightness: 0.8, size: 16, layer: 1 },
                          progress: undefined
                        })) as DiplomaticAchievement[]
                      ),
                      visualLayout: {
                        centerX: 400,
                        centerY: 300,
                        radius: 200,
                        rotation: 0,
                        theme: 'classic_gold'
                      },
                      achievements: ACHIEVEMENT_TEMPLATES.map((template, index) => ({
                        ...template,
                        id: template.id || `achievement-${index}`,
                        title: template.title || 'Unknown Achievement',
                        description: template.description || 'Achievement description',
                        category: template.category || 'diplomatic',
                        tier: template.tier || 'bronze',
                        rarity: template.rarity || 'common',
                        achievedAt: index < 3 ? new Date().toISOString() : '', // First 3 achievements unlocked
                        ixTimeContext: IxTime.getCurrentIxTime(),
                        requirements: template.requirements || [],
                        rewards: template.rewards || [],
                        socialReactions: Math.floor(Math.random() * 50),
                        constellationPosition: { x: 0, y: 0, brightness: 0.8, size: 16, layer: 1 },
                        progress: undefined
                      })) as DiplomaticAchievement[],
                      socialMetrics: {
                        totalViews: Math.floor(Math.random() * 1000) + 500,
                        socialShares: Math.floor(Math.random() * 100) + 50,
                        admirers: Math.floor(Math.random() * 200) + 100,
                        influenceScore: Math.floor(Math.random() * 100),
                        trendingAchievements: ['first_contact', 'trade_pioneer']
                      },
                      lastUpdated: new Date().toISOString(),
                      ixTimeContext: IxTime.getCurrentIxTime()
                    }}
                    onAchievementClick={(achievement) => {
                      setSelectedAchievement(achievement);
                      if (achievement.achievedAt) {
                        setShowUnlockModal(true);
                      }
                    }}
                    onAchievementHover={(achievement) => {
                      // Optional: could show preview tooltip
                    }}
                    viewMode="full"
                    interactive={true}
                    showConnections={true}
                    theme="classic_gold"
                  />
                </motion.div>
              )}

              {activeIntelSection === 'activity' && viewerClearanceLevel !== 'PUBLIC' && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
                    <IntelligenceGlyph type="surveillance" />
                    Activity Intelligence
                    <ClassificationBadge level="RESTRICTED" />
                  </h2>

                  <div className="space-y-4">
                    {country.recentActivities?.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-4 p-4 bg-white/5 rounded-lg border-l-4 border-[--intel-amber]"
                      >
                        <div className={cn(
                          "w-3 h-3 rounded-full mt-2",
                          activity.importance === 'high' && "bg-red-400",
                          activity.importance === 'medium' && "bg-[--intel-amber]",
                          activity.importance === 'low' && "bg-green-400"
                        )} />
                        <div className="flex-1">
                          <p className="text-white">{activity.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-[--intel-silver]">
                            <span>{activity.timestamp}</span>
                            {activity.relatedCountry && (
                              <>
                                <span>•</span>
                                <span>Related: {activity.relatedCountry}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className={cn(
                              "capitalize",
                              activity.importance === 'high' && "text-red-400",
                              activity.importance === 'medium' && "text-[--intel-amber]",
                              activity.importance === 'low' && "text-green-400"
                            )}>
                              {activity.importance} Priority
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeIntelSection === 'assessment' && viewerClearanceLevel === 'CONFIDENTIAL' && (
                <motion.div
                  key="assessment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
                    <IntelligenceGlyph type="analysis" />
                    Strategic Assessment
                    <ClassificationBadge level="CONFIDENTIAL" />
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Threat Analysis</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-green-400">
                          <div className="w-3 h-3 bg-green-400 rounded-full" />
                          <span>Economic Stability: LOW RISK</span>
                        </div>
                        <div className="flex items-center gap-3 text-[--intel-amber]">
                          <div className="w-3 h-3 bg-[--intel-amber] rounded-full" />
                          <span>Diplomatic Tensions: MODERATE</span>
                        </div>
                        <div className="flex items-center gap-3 text-blue-400">
                          <div className="w-3 h-3 bg-blue-400 rounded-full" />
                          <span>Regional Influence: EXPANDING</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Recommendations</h3>
                      <div className="space-y-2 text-[--intel-silver]">
                        <p>• Maintain diplomatic monitoring</p>
                        <p>• Consider economic cooperation opportunities</p>
                        <p>• Monitor regional alliance activities</p>
                        <p>• Assess cultural influence expansion</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Clearance Restriction Display */}
              {((activeIntelSection === 'channels' && viewerClearanceLevel === 'PUBLIC') ||
                (activeIntelSection === 'activity' && viewerClearanceLevel === 'PUBLIC') ||
                (activeIntelSection === 'assessment' && viewerClearanceLevel !== 'CONFIDENTIAL')) && (
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
                    {activeIntelSection === 'activity' || activeIntelSection === 'channels' ? 'RESTRICTED' : 'CONFIDENTIAL'} clearance required to access this intelligence section.
                  </p>
                  <ClassificationBadge level={viewerClearanceLevel} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Diplomatic Actions Modal */}
      <AnimatePresence>
        {showDiplomaticActions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDiplomaticActions(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001]"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 z-[10002] glass-modal rounded-xl p-6"
              style={{
                background: 'var(--intel-classification-overlay)',
                border: 'var(--intel-security-border)',
                backdropFilter: 'var(--intel-glass-blur)'
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[--intel-gold]/20 pb-4">
                  <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
                    <IntelligenceGlyph type="diplomatic" />
                    Diplomatic Actions
                  </h3>
                  <button
                    onClick={() => setShowDiplomaticActions(false)}
                    className="text-[--intel-silver] hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { action: 'follow', icon: RiUserAddLine, label: 'Follow Nation', desc: 'Monitor diplomatic developments and achievements', color: 'text-blue-400' },
                    { action: 'message', icon: RiChat3Line, label: 'Diplomatic Message', desc: 'Secure diplomatic correspondence', color: 'text-purple-400' },
                    { action: 'propose', icon: RiShakeHandsLine, label: 'Alliance Proposal', desc: 'Formal diplomatic alliance proposal', color: 'text-green-400' },
                    { action: 'congratulate', icon: RiStarLine, label: 'Congratulate', desc: 'Recognize recent achievements', color: 'text-[--intel-gold]' }
                  ].map(actionItem => (
                    <button
                      key={actionItem.action}
                      onClick={() => {
                        handleSocialAction(actionItem.action as SocialActionType);
                        setShowDiplomaticActions(false);
                      }}
                      className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left border border-white/10"
                    >
                      <actionItem.icon className={cn("h-5 w-5", actionItem.color)} />
                      <div>
                        <div className="font-medium text-white">{actionItem.label}</div>
                        <div className="text-sm text-[--intel-silver]">{actionItem.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
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
    </motion.div>
  );
};

DiplomaticIntelligenceProfileComponent.displayName = 'DiplomaticIntelligenceProfile';

export const DiplomaticIntelligenceProfile = React.memo(DiplomaticIntelligenceProfileComponent);