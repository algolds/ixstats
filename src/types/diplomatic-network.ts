export interface SharedEconomicData {
  tradeVolume: number;
  tradeGrowth: number;
  jointVentures: number;
  investmentValue: number;
  tariffsReduced: number;
  economicBenefit: number;
}

export interface SharedIntelligenceData {
  reportType: "economic" | "political" | "security" | "social";
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
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
  agreementType: "bilateral" | "framework" | "memorandum";
  status: "draft" | "under_review" | "ratified";
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
