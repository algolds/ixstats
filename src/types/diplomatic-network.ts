/**
 * Type definitions for Embassy Network Visualization and Shared Data System
 * Supports diplomatic relations, embassy management, missions, upgrades, and data sharing
 */

export type SharedDataType = 'economic' | 'intelligence' | 'research' | 'cultural' | 'policy';
export type ShareLevel = 'view' | 'collaborate';
export type RelationType = 'alliance' | 'trade' | 'neutral' | 'tension';
export type SecurityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAXIMUM';
export type EmbassyStatus = 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'CLOSED';
export type MissionType = 'TRADE_NEGOTIATION' | 'CULTURAL_EXCHANGE' | 'INTELLIGENCE_GATHERING' | 'CRISIS_MANAGEMENT' | 'ECONOMIC_COOPERATION';
export type MissionDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type MissionStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type UpgradeType = 'SECURITY' | 'STAFF' | 'FACILITIES' | 'TECHNOLOGY' | 'SPECIALIZATION';
export type ClearanceLevel = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';

/**
 * Diplomatic relation between countries
 */
export interface DiplomaticRelation {
  id: string;
  countryId: string;
  countryName: string;
  relationType: RelationType;
  strength: number;
  recentActivity?: string;
  establishedAt: string;
  flagUrl?: string;
  economicTier?: string;
}

/**
 * Embassy mission details
 */
export interface EmbassyMission {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  difficulty: MissionDifficulty;
  duration: number;
  requiredLevel: number;
  experienceReward: number;
  influenceReward: number;
  budgetCost: number;
  successChance: number;
  status: MissionStatus;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Embassy upgrade options
 */
export interface EmbassyUpgrade {
  id: string;
  name: string;
  description: string;
  type: UpgradeType;
  cost: number;
  requiredLevel: number;
  effects: Record<string, number>;
  duration?: number;
  isActive: boolean;
  purchasedAt?: string;
}

/**
 * Game-mode embassy interface with missions and upgrades
 */
export interface EmbassyGameMode {
  id: string;
  targetCountryId: string;
  targetCountryName: string;
  level: number;
  experience: number;
  influence: number;
  budget: number;
  maintenanceCost: number;
  staffCount: number;
  location: string;
  ambassador: string;
  securityLevel: SecurityLevel;
  status: EmbassyStatus;
  specializations: string[];
  establishedAt: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  availableMissions?: EmbassyMission[];
  availableUpgrades?: EmbassyUpgrade[];
}

/**
 * Primary country information
 */
export interface PrimaryCountry {
  id: string;
  name: string;
  flagUrl?: string;
  economicTier?: string;
}

/**
 * Props for EmbassyNetworkVisualization component
 */
export interface EmbassyNetworkVisualizationProps {
  primaryCountry: PrimaryCountry;
  diplomaticRelations: DiplomaticRelation[];
  onRelationClick?: (relation: DiplomaticRelation) => void;
  onEstablishEmbassy?: (targetCountryId: string) => void;
  viewerClearanceLevel?: ClearanceLevel;
}

/**
 * Network position for graph visualization
 */
export interface NetworkPosition {
  relation: DiplomaticRelation;
  x: number;
  y: number;
}

export interface SharedData {
  id: string;
  embassyId: string;
  dataType: SharedDataType;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  shareLevel: ShareLevel;
  sharedBy: string; // country ID
  sharedWith: string; // country ID
  createdAt: string;
  expiresAt?: string;
  updatedAt?: string;
}

export interface SharedEconomicData {
  tradeVolume: number;
  tradeGrowth: number;
  jointVentures: number;
  investmentValue: number;
  tariffsReduced: number;
  economicBenefit: number;
}

export interface SharedIntelligenceData {
  reportType: 'economic' | 'political' | 'security' | 'social';
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  summary: string;
  keyFindings: string[];
  confidence: number; // 0-100
  lastUpdated: string;
}

export interface SharedResearchData {
  researchArea: string;
  collaborators: string[];
  progress: number; // 0-100
  breakthroughs: string[];
  publications: number;
  patents: number;
}

export interface SharedCulturalData {
  exchangePrograms: number;
  culturalEvents: number;
  artistsExchanged: number;
  studentsExchanged: number;
  culturalImpactScore: number; // 0-100
  diplomaticGoodwill: number; // 0-100
}

export interface SharedPolicyData {
  policyFramework: string;
  agreementType: 'bilateral' | 'framework' | 'memorandum';
  status: 'draft' | 'under_review' | 'ratified';
  effectiveDate?: string;
  keyProvisions: string[];
  compliance: number; // 0-100
}

export interface SharedDataCollection {
  economic?: SharedEconomicData;
  intelligence?: SharedIntelligenceData[];
  research?: SharedResearchData[];
  cultural?: SharedCulturalData;
  policy?: SharedPolicyData[];
}

export interface Embassy {
  id: string;
  name: string; // Embassy name/title
  hostCountryId: string;
  guestCountryId: string;
  hostCountry: string;
  hostCountryFlag: string | null;
  hostCountrySlug: string | null;
  guestCountry: string;
  guestCountryFlag: string | null;
  guestCountrySlug: string | null;
  countryId: string | null;
  country: string; // Partner country (from viewer's perspective)
  countryFlag: string | null;
  countrySlug: string | null;
  status: string;
  strength: number;
  role: 'host' | 'guest';
  ambassadorName?: string | null;
  location?: string | null;
  staffCount?: number | null;
  services?: string[];
  establishedAt: string;
  level?: number | null;
  experience?: number | null;
  influence?: number | null;
  budget?: number | null;
  maintenanceCost?: number | null;
  securityLevel?: string | null;
  specialization?: string | null;
  specializationLevel?: number | null;
  lastMaintenance?: string | null;
  updatedAt: string;
}
