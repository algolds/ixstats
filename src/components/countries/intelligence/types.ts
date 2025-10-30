// Shared types for Intelligence Briefing components
// Extracted from EnhancedIntelligenceBriefing.tsx for reusability

export interface VitalityMetric {
  id: string;
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  trend: "up" | "down" | "stable";
  status: "excellent" | "good" | "fair" | "poor";
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
}

export interface CountryMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  trend?: {
    direction: "up" | "down" | "stable";
    value: number;
    period: string;
  };
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  importance: "critical" | "high" | "medium" | "low";
}

export interface IntelligenceAlert {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface CountryInformation {
  id: string;
  category: string;
  items: {
    label: string;
    value: string;
    classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  }[];
  icon: React.ElementType;
}

export interface WikiSection {
  id: string;
  title: string;
  content: string;
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  importance: "critical" | "high" | "medium" | "low";
  images?: string[];
}

export interface WikiIntelligenceData {
  countryName: string;
  sections: WikiSection[];
  lastUpdated: number;
  confidence: number;
  infobox?: {
    image_flag?: string;
    flag?: string;
    image_coat?: string;
    coat_of_arms?: string;
    [key: string]: any;
  };
}

export interface CountryData {
  id: string;
  name: string;
  continent?: string;
  region?: string;
  governmentType?: string;
  leader?: string;
  religion?: string;
  capital?: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  populationDensity?: number;
  landArea?: number;
  lastCalculated: number;
  baselineDate: number;
}

export type ClearanceLevel = "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
export type TrendDirection = "up" | "down" | "stable";
export type StatusLevel = "excellent" | "good" | "fair" | "poor";
export type ImportanceLevel = "critical" | "high" | "medium" | "low";
