// src/app/admin/economic-archetypes/_components/archetype-form-types.ts
export type ArchetypeEra = "modern" | "historical";

export interface ArchetypeFormData {
  key: string;
  name: string;
  description: string;
  region: string;
  era: ArchetypeEra;
  implementationComplexity: string;
  historicalContext: string;
  characteristics: string[];
  economicComponents: string[];
  governmentComponents: string[];
  taxProfile: {
    corporateTax: number;
    incomeTax: number;
    consumptionTax: number;
    taxEfficiency: number;
  };
  sectorFocus: Record<string, number>;
  employmentProfile: {
    unemploymentRate: number;
    laborParticipation: number;
    wageGrowth: number;
  };
  growthMetrics: {
    gdpGrowth: number;
    innovationIndex: number;
    competitiveness: number;
    stability: number;
  };
  strengths: string[];
  challenges: string[];
  culturalFactors: string[];
  modernExamples: string[];
  recommendations: string[];
}

export const COMPLEXITY_LEVELS = ["Low", "Moderate", "High", "Very High"] as const;

export const SECTOR_TYPES = [
  "agriculture",
  "manufacturing",
  "services",
  "technology",
  "finance",
  "tourism",
] as const;

export const ECONOMIC_COMPONENTS = [
  "Free Market Economy",
  "State Capitalism",
  "Welfare State",
  "Export-Oriented Industrialization",
  "Import Substitution",
  "Resource-Based Economy",
  "Knowledge Economy",
  "Agrarian Economy",
] as const;

export const GOVERNMENT_COMPONENTS = [
  "Liberal Democracy",
  "Authoritarian Regime",
  "Social Democracy",
  "Constitutional Monarchy",
  "Technocracy",
  "Federal Republic",
  "Unitary State",
] as const;
