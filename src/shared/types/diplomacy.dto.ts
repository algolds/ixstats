export interface DiplomaticRelationDto {
  id: string;
  targetCountry: string;
  targetCountryId: string;
  targetCountryName: string;
  targetCountryFlag: string | null;
  relationship: "ALLIED" | "FRIENDLY" | "NEUTRAL" | "TENSE" | "HOSTILE" | "WAR";
  strength: number;
  treaties: string[];
  lastContact: string;
  status: string;
  diplomaticChannels: string[];
  tradeVolume: number;
  culturalExchange: string;
  activePolicies: string[];
  recentIncidents: string[];
}

export interface EmbassyDto {
  id: string;
  hostCountryId: string;
  hostCountryName: string;
  hostCountryFlag: string | null;
  level: number;
  status: string;
  establishedDate: string;
  upkeepCost: number;
  securityLevel: string;
  culturalInfluence: number;
  tradeBonus: number;
  intelligenceBonus: number;
  staffCount: number;
  missionCount: number;
  perks: string[];
  profile?: string | null;
  activeMissions: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
    targetDate: string | null;
  }>;
}

export interface CulturalExchangeDto {
  id: string;
  title: string;
  type: string;
  initiatorId: string;
  initiatorName: string;
  targetId: string | null;
  targetName: string | null;
  status: string;
  startDate: string;
  endDate: string;
  participants: number;
  impactScore: number;
  focusArea: string;
  description: string | null;
  artifacts: number;
  isNpcInteraction: boolean;
  linkedMissionId: string | null;
}

export interface ForeignPolicyDto {
  id: string;
  title: string;
  type: string;
  targetCountryId: string | null;
  targetCountryName: string | null;
  targetRegion: string | null;
  status: "ACTIVE" | "PROPOSED" | "EXPIRED" | "REVOKED";
  startDate: string;
  endDate: string | null;
  economicImpact: number;
  diplomaticImpact: number;
  securityImpact: number;
  description: string;
  conditions: string[];
}
