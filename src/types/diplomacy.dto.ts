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
  flagUrl?: string | null;
  establishedAt?: string;
  goalSelf?: string | null;
  goalTarget?: string | null;
  recentActivity?: string | null;
}
