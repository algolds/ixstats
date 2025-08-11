// Types for the enhanced social country profile system

export interface SocialMetrics {
  followers: number;
  recentVisitors: number;
  diplomaticRelationships: number;
  achievementPoints: number;
  influenceScore: number;
  engagementRate: number;
}

export interface NationalMilestone {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'diplomatic' | 'social' | 'development';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary';
  achievedAt: string; // IxTime timestamp
  ixTimeEpoch: number; // Exact IxTime when achieved
  celebrationState: 'new' | 'acknowledged' | 'archived';
  socialReactions: PlayerReaction[];
  rarity: number; // 1-100, how rare this achievement is
  requirements?: string[];
  icon?: string;
}

export interface PlayerReaction {
  id: string;
  playerId: string;
  playerCountryName: string;
  reactionType: 'congratulate' | 'impressed' | 'inspired' | 'applaud';
  timestamp: string;
  message?: string;
}

export interface GrowthStreak {
  id: string;
  type: 'economic' | 'population' | 'development' | 'diplomatic';
  currentStreak: number;
  bestStreak: number;
  lastUpdate: string;
  isActive: boolean;
  milestones: StreakMilestone[];
}

export interface StreakMilestone {
  quarters: number;
  title: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface UniqueAchievement {
  id: string;
  title: string;
  description: string;
  uniqueCategory: 'first_to_achieve' | 'fastest_growth' | 'highest_tier' | 'diplomatic_master' | 'social_leader';
  globalRarity: number; // How many countries have this achievement
  specialBadge?: string;
  historicalSignificance?: string;
}

export interface MilestoneTarget {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'diplomatic' | 'social' | 'development';
  targetValue: number;
  currentValue: number;
  progressPercentage: number;
  estimatedCompletion?: string; // IxTime estimate
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  rewards: string[];
}

export interface DiplomaticRelation {
  id: string;
  countryId: string;
  countryName: string;
  flagUrl?: string;
  relationType: 'alliance' | 'trade' | 'defense_pact' | 'neutral' | 'tension' | 'rivalry';
  relationshipStrength: number; // 0-100
  establishedDate: string; // IxTime
  lastInteraction: string;
  recentActivity?: DiplomaticActivity[];
  treatiesActive: Treaty[];
  tradeValue?: number;
  mutualBenefits: string[];
}

export interface DiplomaticActivity {
  id: string;
  type: 'treaty_signed' | 'trade_agreement' | 'diplomatic_visit' | 'alliance_formed' | 'tension_escalated';
  title: string;
  description: string;
  timestamp: string;
  impact: 'positive' | 'negative' | 'neutral';
  participants: string[];
}

export interface Treaty {
  id: string;
  name: string;
  type: 'trade' | 'defense' | 'non_aggression' | 'alliance' | 'cultural';
  signedDate: string; // IxTime
  expirationDate?: string;
  isActive: boolean;
  benefits: string[];
  obligations: string[];
}

export interface SocialActivity {
  id: string;
  type: 'achievement_earned' | 'diplomatic_event' | 'visitor_milestone' | 'growth_streak' | 'social_interaction';
  title: string;
  description: string;
  timestamp: string; // IxTime
  importance: 'low' | 'medium' | 'high' | 'critical';
  relatedCountries?: string[];
  category: 'achievement' | 'diplomacy' | 'economy' | 'social';
  visibilityLevel: 'public' | 'followers' | 'allies' | 'private';
  engagementMetrics: {
    views: number;
    reactions: number;
    shares: number;
    comments: number;
  };
}

export interface CountryFollower {
  id: string;
  countryId: string;
  countryName: string;
  flagUrl?: string;
  followedSince: string; // IxTime
  interactionLevel: 'active' | 'moderate' | 'passive';
  lastInteraction?: string;
  notifications: boolean;
}

export interface CountryVisitor {
  id: string;
  countryId: string;
  countryName: string;
  flagUrl?: string;
  visitTimestamp: string; // IxTime
  visitDuration?: number; // seconds
  pagesViewed: string[];
  isReturn: boolean;
  totalVisits: number;
}

export interface PublicMessage {
  id: string;
  fromCountryId: string;
  fromCountryName: string;
  fromFlagUrl?: string;
  message: string;
  timestamp: string; // IxTime
  messageType: 'congratulations' | 'diplomatic' | 'trade_inquiry' | 'general' | 'alliance_proposal';
  isPublic: boolean;
  responses?: PublicMessage[];
  reactions: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  countryId: string;
  reactionType: 'like' | 'support' | 'applause' | 'diplomatic' | 'trade_interested';
  timestamp: string;
}

export interface CollaborationRequest {
  id: string;
  fromCountryId: string;
  fromCountryName: string;
  fromFlagUrl?: string;
  requestType: 'alliance_proposal' | 'trade_agreement' | 'defense_pact' | 'cultural_exchange' | 'joint_project';
  title: string;
  description: string;
  proposedTerms: string[];
  benefits: string[];
  timeline?: string;
  status: 'pending' | 'accepted' | 'declined' | 'negotiating';
  timestamp: string; // IxTime
  expiresAt?: string; // IxTime
}

export interface RegionalContext {
  regionName: string;
  continent: string;
  neighboringCountries: string[];
  regionalRanking: {
    economic: number;
    population: number;
    influence: number;
    development: number;
  };
  regionalEvents: RegionalEvent[];
  tradingBlocs: string[];
  culturalConnections: string[];
}

export interface RegionalEvent {
  id: string;
  title: string;
  description: string;
  eventType: 'economic_summit' | 'trade_agreement' | 'regional_crisis' | 'cultural_festival' | 'diplomatic_meeting';
  timestamp: string; // IxTime
  participatingCountries: string[];
  impact: 'positive' | 'negative' | 'neutral';
  outcomes?: string[];
}

export interface SocialNotification {
  id: string;
  type: 'new_follower' | 'achievement_reaction' | 'diplomatic_message' | 'collaboration_request' | 'milestone_reached';
  title: string;
  message: string;
  fromCountryId?: string;
  fromCountryName?: string;
  timestamp: string; // IxTime
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  actionLabel?: string;
}

export interface PlayerInteraction {
  id: string;
  interactionType: 'profile_view' | 'follow' | 'message' | 'reaction' | 'collaboration';
  participantCountries: string[];
  timestamp: string; // IxTime
  context?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
  followUpRequired?: boolean;
}

export interface SocialEngagementData {
  totalProfileViews: number;
  dailyViews: number;
  followerGrowthRate: number;
  engagementScore: number; // Calculated based on interactions
  popularContent: string[]; // Most viewed/engaged content
  peakActivityTime: string; // When most active
  internationalReach: number; // How many different countries interact
}

export interface DiplomaticSummary {
  totalRelationships: number;
  allianceCount: number;
  tradePartnerCount: number;
  activeConflicts: number;
  pendingProposals: number;
  diplomaticScore: number; // Overall diplomatic health
  recentDiplomaticEvents: DiplomaticActivity[];
  strengthByRegion: { [region: string]: number };
}

export interface AchievementConstellation {
  recentMilestones: NationalMilestone[];
  activeStreaks: GrowthStreak[];
  rareAccomplishments: UniqueAchievement[];
  upcomingTargets: MilestoneTarget[];
  totalAchievementScore: number;
  achievementRanking: {
    global: number;
    regional: number;
    tierBased: number;
  };
}

// Enhanced country profile data structure that extends the existing CountryCardData
export interface EnhancedCountryProfileData {
  // Basic country information
  id: string;
  name: string;
  flagUrl?: string;
  unsplashImageUrl?: string; // Dynamic tier-based image
  
  // Economic data
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea?: number;
  populationDensity?: number;
  gdpDensity?: number;
  adjustedGdpGrowth?: number;
  populationGrowthRate?: number;
  
  // Enhanced social features
  socialMetrics: SocialMetrics;
  achievementConstellation: AchievementConstellation;
  diplomaticRelations: DiplomaticRelation[];
  recentActivities: SocialActivity[];
  
  // Social interactions
  followers: CountryFollower[];
  recentVisitors: CountryVisitor[];
  publicMessages: PublicMessage[];
  collaborationRequests: CollaborationRequest[];
  
  // Context and rankings
  regionalContext: RegionalContext;
  globalRanking?: number;
  regionalRanking?: number;
  growthStreak: number;
  influenceLevel: 'emerging' | 'regional' | 'major' | 'global' | 'superpower';
  
  // Temporal context
  lastUpdated: string; // IxTime
  profileCreated: string; // IxTime
  nextMilestoneCheck: string; // IxTime
}

// Action types for social interactions
export type SocialActionType = 
  | 'follow' 
  | 'unfollow' 
  | 'message' 
  | 'congratulate' 
  | 'propose_alliance' 
  | 'propose_trade' 
  | 'visit_profile' 
  | 'react_to_achievement' 
  | 'invite_collaboration';

export interface SocialActionPayload {
  action: SocialActionType;
  targetCountryId: string;
  sourceCountryId: string;
  data?: Record<string, any>;
  timestamp: string; // IxTime
}

// Response types for social actions
export interface SocialActionResponse {
  success: boolean;
  message: string;
  data?: any;
  updatedRelationship?: DiplomaticRelation;
  newNotifications?: SocialNotification[];
}

export default {};