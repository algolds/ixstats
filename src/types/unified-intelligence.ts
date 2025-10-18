/**
 * Unified Intelligence System Types
 *
 * Comprehensive TypeScript interfaces for the unified intelligence system
 * integrating executive dashboards, policy management, diplomatic operations,
 * analytics, and real-time intelligence across all country operations.
 *
 * @module unified-intelligence
 */

import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from '@prisma/client';
import type {
  ClassificationLevel as DiplomaticClassificationLevel,
  EncryptedMessage,
  KeySecurityStatus,
  EncryptionStatistics
} from './diplomatic-encryption';

// ============================================================================
// BASE TYPES AND ENUMS
// ============================================================================

/**
 * Extended classification levels for intelligence system
 * Includes all diplomatic levels plus intelligence-specific levels
 */
export type ClassificationLevel =
  | 'PUBLIC'
  | 'RESTRICTED'
  | 'CONFIDENTIAL'
  | 'SECRET'
  | 'TOP_SECRET';

/**
 * Priority levels for intelligence items
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Urgency levels for actions and recommendations
 */
export type Urgency = 'urgent' | 'important' | 'routine' | 'future';

/**
 * Status for intelligence items and actions
 */
export type Status = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

/**
 * Trend direction for metrics and analytics
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Time horizons for predictions and forecasts
 */
export type TimeHorizon = 'immediate' | 'short' | 'medium' | 'long';

/**
 * Intelligence categories
 */
export type IntelligenceCategory =
  | 'economic'
  | 'population'
  | 'diplomatic'
  | 'governance'
  | 'military'
  | 'crisis'
  | 'opportunity'
  | 'security';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

// ============================================================================
// INTELLIGENCE SYSTEM TYPES
// ============================================================================

/**
 * Enhanced metric with comprehensive context and trend analysis
 */
export interface IntelligenceMetric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend: TrendDirection;
  changeValue: number;
  changePercent: number;
  changePeriod: string;
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  rank?: {
    global: number;
    regional: number;
    total: number;
  };
  target?: {
    value: number;
    achieved: boolean;
    timeToTarget?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Intelligence alert with severity, category, and action requirements
 */
export interface IntelligenceAlert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: IntelligenceCategory;
  priority: Priority;
  actionRequired: boolean;
  timeframe: TimeHorizon;
  estimatedImpact: {
    magnitude: 'low' | 'medium' | 'high' | 'severe';
    areas: string[];
    economicCost?: number;
    populationAffected?: number;
  };
  recommendedActions: string[];
  relatedMetrics?: string[]; // IDs of related metrics
  classification: ClassificationLevel;
  createdAt: number;
  expiresAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * Intelligence briefing with classification and content
 */
export interface IntelligenceBriefing {
  id: string;
  title: string;
  classification: ClassificationLevel;
  category: IntelligenceCategory;
  priority: Priority;
  summary: string;
  content: string;
  keyPoints: string[];
  recommendations: string[];
  attachments?: BriefingAttachment[];
  sources: IntelligenceSource[];
  relatedBriefings?: string[]; // IDs of related briefings
  tags: string[];
  createdAt: number;
  updatedAt?: number;
  validUntil?: number;
  author: {
    id: string;
    name: string;
    role: string;
  };
  distribution: {
    clearanceRequired: ClassificationLevel;
    recipientIds: string[];
    viewCount: number;
    acknowledgedBy: string[];
  };
  metadata?: Record<string, any>;
}

/**
 * Briefing attachment
 */
export interface BriefingAttachment {
  id: string;
  name: string;
  type: 'document' | 'image' | 'chart' | 'data' | 'video' | 'link';
  url?: string;
  classification: ClassificationLevel;
  size?: number;
  uploadedAt: number;
  uploadedBy: string;
}

/**
 * Intelligence source information
 */
export interface IntelligenceSource {
  type: 'internal' | 'external' | 'human' | 'signals' | 'open' | 'ai';
  name: string;
  reliability: 'verified' | 'probable' | 'unconfirmed' | 'questionable';
  confidence: number; // 0-100
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Intelligence recommendation with urgency, impact, and prerequisites
 */
export interface IntelligenceRecommendation {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  urgency: Urgency;
  priority: Priority;
  difficulty: 'easy' | 'moderate' | 'complex' | 'major';
  estimatedDuration: string;
  estimatedCost: string;
  estimatedBenefit: string;
  prerequisites: string[];
  risks: string[];
  successProbability: number; // 0-100
  impact: {
    economic?: number;
    social?: number;
    diplomatic?: number;
    governance?: number;
    military?: number;
  };
  aiGenerated: boolean;
  basis: string[]; // What data/metrics led to this recommendation
  alternatives?: IntelligenceRecommendation[];
  implementationSteps?: string[];
  createdAt: number;
  expiresAt?: number;
  status: Status;
  assignedTo?: string;
  metadata?: Record<string, any>;
}

/**
 * Intelligence trend with direction, confidence, and context
 */
export interface IntelligenceTrend {
  id: string;
  name: string;
  category: IntelligenceCategory;
  direction: TrendDirection;
  magnitude: 'minor' | 'moderate' | 'major' | 'critical';
  confidence: number; // 0-100
  timeframe: string;
  startValue: number;
  currentValue: number;
  projectedValue?: number;
  context: string;
  drivingFactors: string[];
  relatedMetrics: string[]; // IDs of related metrics
  historicalData: Array<{
    timestamp: number;
    value: number;
  }>;
  createdAt: number;
  metadata?: Record<string, any>;
}

/**
 * Complete executive dashboard overview
 */
export interface IntelligenceOverview {
  countryId: string;
  countryName: string;
  generatedAt: number;
  nextUpdate: number;

  // Immediate attention
  criticalAlerts: IntelligenceAlert[];
  urgentActions: IntelligenceRecommendation[];
  latestBriefings: IntelligenceBriefing[];

  // Core metrics
  keyMetrics: IntelligenceMetric[];
  vitalityScores: VitalityIntelligence[];

  // Trends and predictions
  trendingInsights: TrendingInsight[];
  forwardIntelligence: ForwardIntelligence;

  // Overall assessment
  overallStatus: 'excellent' | 'good' | 'concerning' | 'critical';
  confidenceLevel: number; // 0-100
  statusSummary: string;
  lastMajorChange?: {
    date: number;
    description: string;
    impact: string;
  };

  // Display and interaction
  viewMode: 'executive' | 'detailed' | 'crisis';
  priorityThreshold: Priority;

  metadata?: Record<string, any>;
}

/**
 * Trending insight for performance context
 */
export interface TrendingInsight {
  id: string;
  title: string;
  description: string;
  category: 'performance' | 'ranking' | 'opportunity' | 'comparison';
  icon: string; // Lucide icon name
  trend: TrendDirection;
  significance: 'major' | 'moderate' | 'minor';
  metrics: IntelligenceMetric[];
  context: {
    comparison?: 'peer' | 'historical' | 'target';
    timeframe: string;
    confidence: number; // 0-100
  };
  actionable: boolean;
  nextReview?: number;
  metadata?: Record<string, any>;
}

/**
 * Vitality intelligence with contextual analysis
 */
export interface VitalityIntelligence {
  area: IntelligenceCategory;
  score: number; // 0-100
  trend: TrendDirection;
  change: {
    value: number;
    period: string;
    reason: string;
  };
  status: 'excellent' | 'good' | 'concerning' | 'critical';
  keyMetrics: IntelligenceMetric[];
  criticalAlerts: IntelligenceAlert[];
  recommendations: IntelligenceRecommendation[];
  forecast: {
    shortTerm: { // 3 months
      projected: number;
      confidence: number;
      factors: string[];
    };
    longTerm: { // 1 year
      projected: number;
      confidence: number;
      factors: string[];
    };
  };
  comparisons: {
    peerAverage: number;
    regionalAverage: number;
    historicalBest: number;
    rank: number;
    totalCountries: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Forward-looking intelligence for strategic planning
 */
export interface ForwardIntelligence {
  predictions: PredictionIntelligence[];
  opportunities: OpportunityIntelligence[];
  risks: RiskIntelligence[];
  competitiveIntelligence: CompetitiveIntelligence[];
  metadata?: Record<string, any>;
}

/**
 * Prediction intelligence
 */
export interface PredictionIntelligence {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  timeHorizon: TimeHorizon;
  probability: number; // 0-100
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: 'low' | 'medium' | 'high';
  keyFactors: string[];
  mitigation?: IntelligenceRecommendation[];
  createdAt: number;
  confidence: number;
  metadata?: Record<string, any>;
}

/**
 * Opportunity intelligence
 */
export interface OpportunityIntelligence {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  timeWindow: {
    start: number;
    end: number;
    optimal: number;
  };
  difficulty: 'easy' | 'moderate' | 'complex';
  requirements: string[];
  expectedBenefit: string;
  successProbability: number;
  estimatedValue: number;
  createdAt: number;
  metadata?: Record<string, any>;
}

/**
 * Risk intelligence
 */
export interface RiskIntelligence {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  probability: number; // 0-100
  impact: 'low' | 'medium' | 'high' | 'severe';
  timeframe: TimeHorizon;
  earlyWarnings: string[];
  mitigation: IntelligenceRecommendation[];
  currentStatus: 'monitoring' | 'active' | 'mitigated' | 'realized';
  createdAt: number;
  metadata?: Record<string, any>;
}

/**
 * Competitive intelligence
 */
export interface CompetitiveIntelligence {
  id: string;
  title: string;
  targetCountry: string;
  category: 'peer' | 'competitor' | 'ally' | 'regional';
  insights: string[];
  implications: string[];
  recommendedResponse?: IntelligenceRecommendation;
  classification: ClassificationLevel;
  createdAt: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// MEETING SYSTEM TYPES
// ============================================================================

/**
 * Cabinet meeting with agenda, decisions, and actions
 */
export interface CabinetMeeting {
  id: string;
  countryId: string;
  title: string;
  description?: string;
  classification: ClassificationLevel;
  scheduledAt: number;
  startedAt?: number;
  endedAt?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  chair: GovernmentOfficial;
  attendees: GovernmentOfficial[];
  absentees?: GovernmentOfficial[];
  agenda: MeetingAgendaItem[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
  minutes?: string;
  summaryBriefing?: string;
  nextMeeting?: {
    scheduledAt: number;
    tentativeAgenda: string[];
  };
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, any>;
}

/**
 * Meeting agenda item
 */
export interface MeetingAgendaItem {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  priority: Priority;
  estimatedDuration: number; // minutes
  presenter: GovernmentOfficial;
  status: 'pending' | 'in_progress' | 'completed' | 'deferred';
  order: number;
  attachments?: BriefingAttachment[];
  discussionPoints?: string[];
  outcome?: string;
  timeSpent?: number; // actual minutes spent
  metadata?: Record<string, any>;
}

/**
 * Meeting decision
 */
export interface MeetingDecision {
  id: string;
  meetingId: string;
  agendaItemId?: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  outcome: 'approved' | 'rejected' | 'deferred' | 'modified';
  votes?: {
    for: number;
    against: number;
    abstain: number;
    voters: Array<{
      officialId: string;
      vote: 'for' | 'against' | 'abstain';
    }>;
  };
  affectedPolicies?: string[]; // Policy IDs
  affectedDepartments?: string[]; // Department IDs
  budgetImpact?: number;
  implementationDeadline?: number;
  responsibleOfficials: GovernmentOfficial[];
  rationale?: string;
  dissent?: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

/**
 * Meeting action item
 */
export interface MeetingActionItem {
  id: string;
  meetingId: string;
  decisionId?: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  priority: Priority;
  status: Status;
  assignedTo: GovernmentOfficial;
  assignedBy: GovernmentOfficial;
  deadline: number;
  estimatedEffort: string;
  dependencies?: string[]; // Other action item IDs
  progress: number; // 0-100
  updates?: Array<{
    timestamp: number;
    note: string;
    progressDelta: number;
  }>;
  completedAt?: number;
  createdAt: number;
  metadata?: Record<string, any>;
}

/**
 * Government official
 */
export interface GovernmentOfficial {
  id: string;
  userId?: string;
  name: string;
  role: string;
  department?: string;
  title: string;
  clearanceLevel: ClassificationLevel;
  status: 'active' | 'inactive' | 'suspended';
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  avatar?: string;
  appointedAt?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// POLICY SYSTEM TYPES
// ============================================================================

/**
 * Complete policy with all fields
 */
export interface PolicyData {
  id: string;
  countryId: string;
  name: string;
  description: string;
  category: IntelligenceCategory;
  type: 'domestic' | 'foreign' | 'economic' | 'social' | 'security' | 'environmental';
  status: 'draft' | 'proposed' | 'active' | 'suspended' | 'archived';
  classification: ClassificationLevel;

  // Policy details
  objectives: string[];
  targetMetrics?: Array<{
    metricName: string;
    currentValue: number;
    targetValue: number;
    timeframe: string;
  }>;

  // Governance
  sponsor: GovernmentOfficial;
  supportingOfficials: GovernmentOfficial[];
  opposingOfficials?: GovernmentOfficial[];
  affectedDepartments: string[]; // Department IDs

  // Impact analysis
  impact: PolicyImpact;
  validation: PolicyValidation;

  // Implementation
  implementationPlan?: string;
  implementationStatus?: {
    phase: 'planning' | 'execution' | 'review' | 'completed';
    progress: number; // 0-100
    milestones: Array<{
      name: string;
      dueDate: number;
      completed: boolean;
      completedAt?: number;
    }>;
  };

  // Budget
  budget?: {
    allocated: number;
    spent: number;
    projected: number;
    source: string;
  };

  // Lifecycle
  proposedAt: number;
  approvedAt?: number;
  effectiveFrom?: number;
  effectiveUntil?: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;

  // Related items
  relatedPolicies?: string[]; // Policy IDs
  supersedes?: string; // Policy ID
  supersededBy?: string; // Policy ID

  // Tracking
  version: number;
  changeHistory?: Array<{
    version: number;
    changedAt: number;
    changedBy: string;
    changes: string[];
  }>;

  // Builder context
  builderContext?: BuilderPolicyContext;

  metadata?: Record<string, any>;
}

/**
 * Policy impact analysis
 */
export interface PolicyImpact {
  // Quantitative impacts
  economic: {
    gdpImpact: number; // Percentage
    budgetImpact: number; // Currency
    employmentImpact: number; // Jobs created/lost
    revenueImpact: number; // Tax revenue change
  };

  social: {
    populationAffected: number;
    qualityOfLifeImpact: number; // -100 to 100 scale
    inequalityImpact: number; // Gini coefficient change
    approvalRating: number; // 0-100
  };

  diplomatic: {
    internationalOpinion: number; // -100 to 100
    allianceStrength: number; // -100 to 100
    tradeImpact: number; // Percentage
    affectedCountries: string[]; // Country IDs
  };

  governance: {
    efficiencyGain: number; // Percentage
    transparencyChange: number; // -100 to 100
    corruptionImpact: number; // -100 to 100 (negative = reduced corruption)
    institutionalStrength: number; // -100 to 100
  };

  environmental?: {
    carbonImpact: number; // Tons CO2
    sustainabilityScore: number; // 0-100
    resourceUsage: number; // Percentage change
  };

  // Qualitative impacts
  risks: string[];
  opportunities: string[];
  unintendedConsequences?: string[];

  // Confidence and timeline
  confidence: number; // 0-100
  timeToRealize: string;
  sustainabilityScore: number; // 0-100
}

/**
 * Policy validation result
 */
export interface PolicyValidation {
  isValid: boolean;
  errors: PolicyValidationMessage[];
  warnings: PolicyValidationMessage[];
  score: number; // 0-100 overall policy quality score

  // Validation checks
  legalCompliance: {
    compliant: boolean;
    issues: string[];
  };

  budgetFeasibility: {
    feasible: boolean;
    issues: string[];
  };

  politicalViability: {
    viable: boolean;
    supportLevel: number; // 0-100
    opposition: string[];
  };

  technicalFeasibility: {
    feasible: boolean;
    challenges: string[];
  };

  publicSupport: {
    estimatedApproval: number; // 0-100
    concerns: string[];
  };
}

/**
 * Policy validation message
 */
export interface PolicyValidationMessage {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * AI-generated policy recommendation
 */
export interface PolicyRecommendation {
  id: string;
  title: string;
  description: string;
  category: IntelligenceCategory;
  priority: Priority;

  // Recommendation details
  rationale: string;
  expectedOutcomes: string[];
  risks: string[];

  // Policy template
  suggestedPolicy: Partial<PolicyData>;

  // Context
  basedOn: {
    metrics: string[]; // Metric IDs
    trends: string[]; // Trend IDs
    alerts: string[]; // Alert IDs
  };

  confidence: number; // 0-100
  aiModel: string;
  generatedAt: number;
  expiresAt: number;

  // User interaction
  userFeedback?: {
    helpful: boolean;
    implemented: boolean;
    comments?: string;
  };

  metadata?: Record<string, any>;
}

/**
 * Builder state snapshot for policy context
 */
export interface BuilderPolicyContext {
  // Government context
  governmentType?: string;
  activeComponents?: ComponentType[];
  totalBudget?: number;

  // Economic context
  gdp?: number;
  gdpPerCapita?: number;
  growthRate?: number;

  // Social context
  population?: number;
  literacyRate?: number;
  lifeExpectancy?: number;

  // Tax context
  taxRevenue?: number;
  effectiveTaxRate?: number;

  // Constraints
  budgetConstraints?: {
    available: number;
    committed: number;
  };

  politicalConstraints?: string[];

  timestamp: number;
}

// ============================================================================
// DIPLOMATIC SYSTEM TYPES
// ============================================================================

/**
 * Diplomatic channel with classification and participants
 */
export interface DiplomaticChannel {
  id: string;
  name: string;
  description?: string;
  classification: ClassificationLevel;
  type: 'bilateral' | 'multilateral' | 'public' | 'backchannel';
  status: 'active' | 'suspended' | 'closed';

  // Participants
  participatingCountries: string[]; // Country IDs
  moderators?: GovernmentOfficial[];

  // Communication
  encryptionRequired: boolean;
  encryptionStatus?: KeySecurityStatus;
  messageCount: number;
  lastMessageAt?: number;

  // Access control
  accessList: string[]; // User IDs with access
  clearanceRequired: ClassificationLevel;

  createdAt: number;
  createdBy: string;
  metadata?: Record<string, any>;
}

/**
 * Secure diplomatic message
 */
export interface SecureMessage {
  id: string;
  channelId: string;

  // Sender
  fromCountryId: string;
  fromCountryName: string;
  fromOfficial?: GovernmentOfficial;

  // Recipients
  toCountryIds: string[];
  toOfficials?: GovernmentOfficial[];

  // Content
  subject?: string;
  content: string;
  classification: ClassificationLevel;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  // Encryption
  encrypted: boolean;
  encryptionData?: EncryptedMessage;
  verificationStatus: 'verified' | 'unverified' | 'failed' | 'not_applicable';

  // Status
  status: 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED';
  deliveredAt?: number;
  readAt?: number;
  readBy?: string[];

  // Context
  inReplyTo?: string; // Message ID
  references?: string[]; // Related message IDs
  attachments?: BriefingAttachment[];

  // Timing
  ixTimeTimestamp: number;
  createdAt: number;
  expiresAt?: number;

  metadata?: Record<string, any>;
}

/**
 * Embassy with level, influence, budget, and specialization
 */
export interface Embassy {
  id: string;
  ownerCountryId: string;
  hostCountryId: string;

  // Embassy details
  name: string;
  level: 'consulate' | 'embassy' | 'high_commission';
  status: 'active' | 'suspended' | 'closed';

  // Leadership
  ambassador: GovernmentOfficial;
  staff: GovernmentOfficial[];

  // Metrics
  influence: number; // 0-100
  reputation: number; // 0-100
  budget: {
    annual: number;
    spent: number;
    allocated: number;
  };

  // Capabilities
  specialization: EmbassySpecialization[];
  services: string[];

  // Operations
  activeMissions: string[]; // Mission IDs
  completedMissions: string[]; // Mission IDs
  culturalExchanges: string[]; // Exchange IDs

  // Location
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  establishedAt: number;
  lastInspectionAt?: number;
  nextInspectionAt?: number;

  metadata?: Record<string, any>;
}

/**
 * Embassy specialization areas
 */
export type EmbassySpecialization =
  | 'trade'
  | 'military'
  | 'culture'
  | 'intelligence'
  | 'humanitarian'
  | 'technology'
  | 'environment'
  | 'education';

/**
 * Diplomatic mission
 */
export interface DiplomaticMission {
  id: string;
  embassyId: string;

  // Mission details
  name: string;
  description: string;
  type: 'negotiation' | 'humanitarian' | 'intelligence' | 'trade' | 'cultural' | 'crisis';
  classification: ClassificationLevel;
  priority: Priority;

  // Execution
  status: 'planning' | 'active' | 'completed' | 'failed' | 'cancelled';
  difficulty: 'easy' | 'moderate' | 'difficult' | 'extreme';
  progress: number; // 0-100

  // Team
  leadDiplomat: GovernmentOfficial;
  team: GovernmentOfficial[];

  // Objectives
  objectives: string[];
  completedObjectives: string[];

  // Resources
  budget: {
    allocated: number;
    spent: number;
  };

  // Outcomes
  outcome?: {
    success: boolean;
    results: string[];
    impact: PolicyImpact;
    lessons: string[];
  };

  // Timeline
  startedAt: number;
  deadline: number;
  completedAt?: number;

  // Related items
  relatedTreaties?: string[]; // Treaty IDs
  relatedPolicies?: string[]; // Policy IDs

  metadata?: Record<string, any>;
}

/**
 * Cultural exchange program
 */
export interface CulturalExchange {
  id: string;

  // Exchange details
  name: string;
  description: string;
  type: 'education' | 'arts' | 'sports' | 'science' | 'business' | 'youth' | 'professional';
  status: 'planned' | 'active' | 'completed' | 'cancelled';

  // Participants
  participatingCountries: string[]; // Country IDs
  coordinatingEmbassies: string[]; // Embassy IDs
  participants: number;

  // Impact
  culturalImpact: number; // 0-100
  diplomaticValue: number; // 0-100
  publicAwareness: number; // 0-100

  // Budget
  budget: {
    total: number;
    byCountry: Record<string, number>;
    spent: number;
  };

  // Timeline
  startDate: number;
  endDate: number;
  duration: number; // days

  // Outcomes
  outcomes?: {
    participantSatisfaction: number; // 0-100
    mediaCoverage: number;
    followUpInitiatives: string[];
    successStories: string[];
  };

  metadata?: Record<string, any>;
}

/**
 * Treaty or agreement
 */
export interface Treaty {
  id: string;

  // Treaty details
  name: string;
  description: string;
  type: 'bilateral' | 'multilateral' | 'trade' | 'defense' | 'environmental' | 'cultural';
  classification: ClassificationLevel;

  // Parties
  signatories: Array<{
    countryId: string;
    countryName: string;
    signedAt: number;
    signedBy: GovernmentOfficial;
    ratifiedAt?: number;
    status: 'signed' | 'ratified' | 'withdrawn';
  }>;

  // Terms
  terms: string[];
  obligations: Array<{
    party: string; // Country ID
    obligation: string;
    deadline?: number;
    completed: boolean;
  }>;

  // Status
  status: 'negotiating' | 'signed' | 'ratified' | 'active' | 'suspended' | 'terminated';

  // Implementation
  effectiveFrom?: number;
  expiresAt?: number;
  renewalTerms?: string;

  // Compliance
  compliance: Array<{
    countryId: string;
    complianceRate: number; // 0-100
    violations?: string[];
    lastReviewedAt: number;
  }>;

  // Related items
  relatedPolicies?: string[]; // Policy IDs
  relatedMissions?: string[]; // Mission IDs
  supersedes?: string; // Treaty ID

  createdAt: number;
  updatedAt?: number;

  metadata?: Record<string, any>;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Dashboard analytics data
 */
export interface AnalyticsData {
  countryId: string;
  period: {
    start: number;
    end: number;
    label: string;
  };

  // Core metrics
  metrics: {
    economic: EconomicAnalytics;
    social: SocialAnalytics;
    diplomatic: DiplomaticAnalytics;
    governance: GovernanceAnalytics;
  };

  // Aggregated data
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    activePolicies: number;
    completedActions: number;
    overallScore: number; // 0-100
    trend: TrendDirection;
  };

  // Comparisons
  comparisons: ComparisonMetrics;

  generatedAt: number;
  metadata?: Record<string, any>;
}

/**
 * Economic analytics
 */
export interface EconomicAnalytics {
  gdp: HistoricalTrend;
  gdpPerCapita: HistoricalTrend;
  growth: HistoricalTrend;
  unemployment: HistoricalTrend;
  inflation: HistoricalTrend;
  tradeBalance: HistoricalTrend;
  governmentRevenue: HistoricalTrend;
  governmentSpending: HistoricalTrend;

  // Predictions
  predictive: PredictiveModel;
}

/**
 * Social analytics
 */
export interface SocialAnalytics {
  population: HistoricalTrend;
  lifeExpectancy: HistoricalTrend;
  literacyRate: HistoricalTrend;
  urbanization: HistoricalTrend;
  giniCoefficient: HistoricalTrend;

  // Predictions
  predictive: PredictiveModel;
}

/**
 * Diplomatic analytics
 */
export interface DiplomaticAnalytics {
  activeEmbassies: number;
  activeTreaties: number;
  diplomaticInfluence: HistoricalTrend;
  allianceStrength: HistoricalTrend;
  internationalOpinion: HistoricalTrend;
  tradePartners: number;

  // Activity metrics
  messagesExchanged: HistoricalTrend;
  missionsCompleted: HistoricalTrend;
  culturalExchanges: HistoricalTrend;
}

/**
 * Governance analytics
 */
export interface GovernanceAnalytics {
  governmentEfficiency: HistoricalTrend;
  transparency: HistoricalTrend;
  corruptionIndex: HistoricalTrend;
  ruleOfLaw: HistoricalTrend;
  publicApproval: HistoricalTrend;

  // Activity metrics
  activePolicies: number;
  completedActionItems: number;
  cabinetMeetings: number;
  decisionsImplemented: number;
}

/**
 * Historical trend data
 */
export interface HistoricalTrend {
  metric: string;
  unit?: string;
  currentValue: number;
  dataPoints: Array<{
    timestamp: number;
    value: number;
    label?: string;
  }>;
  trend: TrendDirection;
  changePercent: number;
  changePeriod: string;
  annotation?: string;
}

/**
 * Predictive forecasting model
 */
export interface PredictiveModel {
  modelType: 'linear' | 'exponential' | 'polynomial' | 'ml' | 'ensemble';
  confidence: number; // 0-100

  scenarios: Array<{
    name: string;
    description: string;
    probability: number; // 0-100
    forecast: HistoricalTrend;
    assumptions: string[];
  }>;

  keyDrivers: Array<{
    factor: string;
    impact: number; // -100 to 100
    confidence: number; // 0-100
  }>;

  trainedOn: {
    dataPoints: number;
    timeRange: {
      start: number;
      end: number;
    };
    features: string[];
  };

  accuracy: {
    mae: number; // Mean Absolute Error
    rmse: number; // Root Mean Square Error
    r2: number; // R-squared
  };

  generatedAt: number;
  nextUpdate: number;
}

/**
 * Comparative benchmarking metrics
 */
export interface ComparisonMetrics {
  // Peer comparisons
  peerGroup: {
    countries: string[]; // Country IDs
    averages: Record<string, number>;
    rankings: Record<string, number>;
  };

  // Regional comparisons
  regional: {
    region: string;
    countries: string[]; // Country IDs
    averages: Record<string, number>;
    rankings: Record<string, number>;
  };

  // Global comparisons
  global: {
    totalCountries: number;
    rankings: Record<string, number>;
    percentile: Record<string, number>; // 0-100
  };

  // Historical comparisons
  historical: {
    bestPerformance: Record<string, {
      value: number;
      timestamp: number;
    }>;
    worstPerformance: Record<string, {
      value: number;
      timestamp: number;
    }>;
  };
}

// ============================================================================
// TYPE GUARDS AND VALIDATORS
// ============================================================================

/**
 * Check if classification level is valid
 */
export function isValidClassification(level: string): level is ClassificationLevel {
  return ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'].includes(level);
}

/**
 * Check if priority level is valid
 */
export function isValidPriority(priority: string): priority is Priority {
  return ['critical', 'high', 'medium', 'low'].includes(priority);
}

/**
 * Check if user has required clearance
 */
export function hasRequiredClearance(
  userLevel: ClassificationLevel,
  requiredLevel: ClassificationLevel
): boolean {
  const hierarchy: Record<ClassificationLevel, number> = {
    'PUBLIC': 0,
    'RESTRICTED': 1,
    'CONFIDENTIAL': 2,
    'SECRET': 3,
    'TOP_SECRET': 4,
  };

  return hierarchy[userLevel] >= hierarchy[requiredLevel];
}

/**
 * Check if alert has expired
 */
export function isAlertExpired(alert: IntelligenceAlert): boolean {
  return alert.expiresAt ? Date.now() > alert.expiresAt : false;
}

/**
 * Check if recommendation is still valid
 */
export function isRecommendationValid(recommendation: IntelligenceRecommendation): boolean {
  return recommendation.expiresAt ? Date.now() < recommendation.expiresAt : true;
}

/**
 * Get priority order value
 */
export function getPriorityOrder(priority: Priority): number {
  const order: Record<Priority, number> = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1,
  };
  return order[priority];
}

/**
 * Get urgency order value
 */
export function getUrgencyOrder(urgency: Urgency): number {
  const order: Record<Urgency, number> = {
    'urgent': 4,
    'important': 3,
    'routine': 2,
    'future': 1,
  };
  return order[urgency];
}

// ============================================================================
// RESPONSE TYPES FOR TRPC
// ============================================================================

/**
 * Standard success response
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: number;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Intelligence overview response
 */
export type IntelligenceOverviewResponse = SuccessResponse<IntelligenceOverview> | ErrorResponse;

/**
 * Intelligence metrics response
 */
export type IntelligenceMetricsResponse = SuccessResponse<IntelligenceMetric[]> | ErrorResponse;

/**
 * Intelligence alerts response
 */
export type IntelligenceAlertsResponse = SuccessResponse<PaginatedResponse<IntelligenceAlert>> | ErrorResponse;

/**
 * Intelligence briefings response
 */
export type IntelligenceBriefingsResponse = SuccessResponse<PaginatedResponse<IntelligenceBriefing>> | ErrorResponse;

/**
 * Policy data response
 */
export type PolicyDataResponse = SuccessResponse<PolicyData> | ErrorResponse;

/**
 * Policy list response
 */
export type PolicyListResponse = SuccessResponse<PaginatedResponse<PolicyData>> | ErrorResponse;

/**
 * Cabinet meeting response
 */
export type CabinetMeetingResponse = SuccessResponse<CabinetMeeting> | ErrorResponse;

/**
 * Diplomatic channel response
 */
export type DiplomaticChannelResponse = SuccessResponse<DiplomaticChannel> | ErrorResponse;

/**
 * Analytics data response
 */
export type AnalyticsDataResponse = SuccessResponse<AnalyticsData> | ErrorResponse;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Classification level hierarchy
 */
export const CLASSIFICATION_HIERARCHY: Record<ClassificationLevel, number> = {
  'PUBLIC': 0,
  'RESTRICTED': 1,
  'CONFIDENTIAL': 2,
  'SECRET': 3,
  'TOP_SECRET': 4,
};

/**
 * Default intelligence view configuration
 */
export const DEFAULT_INTELLIGENCE_VIEW_CONFIG = {
  mode: 'overview' as const,
  showAlerts: true,
  showRecommendations: true,
  showComparisons: true,
  showForecasts: true,
  priorityFilter: ['critical', 'high', 'medium', 'low'] as Priority[],
  categoryFilter: ['economic', 'population', 'diplomatic', 'governance', 'military', 'crisis'] as IntelligenceCategory[],
  timeHorizonFilter: ['immediate', 'short', 'medium', 'long'] as TimeHorizon[],
  maxItems: {
    alerts: 10,
    insights: 5,
    recommendations: 5,
    forecasts: 3,
  },
};

/**
 * Refresh intervals (milliseconds)
 */
export const REFRESH_INTERVALS = {
  critical: 30000,      // 30 seconds
  high: 60000,          // 1 minute
  medium: 300000,       // 5 minutes
  low: 900000,          // 15 minutes
  analytics: 1800000,   // 30 minutes
  predictions: 3600000, // 1 hour
} as const;
