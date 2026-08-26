/**
 * Pure transforms, constants, and utilities for Economic Components admin
 */

import { EconomicComponentType } from "~/lib/enums";

export const COMPONENT_CATEGORIES = {
  "Economic Model": [
    "FREE_MARKET_SYSTEM",
    "MIXED_ECONOMY",
    "STATE_CAPITALISM",
    "PLANNED_ECONOMY",
    "SOCIAL_MARKET_ECONOMY",
    "RESOURCE_BASED_ECONOMY",
    "KNOWLEDGE_ECONOMY",
    "INNOVATION_ECONOMY",
  ],
  "Sector Focus": [
    "AGRICULTURE_LED",
    "MANUFACTURING_LED",
    "SERVICE_BASED",
    "TECHNOLOGY_FOCUSED",
    "FINANCE_CENTERED",
    "EXPORT_ORIENTED",
    "DOMESTIC_FOCUSED",
    "TOURISM_BASED",
  ],
  "Labor System": [
    "FLEXIBLE_LABOR",
    "PROTECTED_WORKERS",
    "UNION_BASED",
    "GIG_ECONOMY",
    "PROFESSIONAL_SERVICES",
    "SKILL_BASED",
    "EDUCATION_FIRST",
    "MERIT_BASED",
    "HIGH_SKILLED_WORKERS",
    "EDUCATION_FOCUSED",
    "HEALTHCARE_FOCUSED",
    "VOCATIONAL_TRAINING",
  ],
  "Trade Policy": [
    "FREE_TRADE",
    "PROTECTIONIST",
    "BALANCED_TRADE",
    "EXPORT_SUBSIDY",
    "IMPORT_SUBSTITUTION",
    "TRADE_BLOC",
    "BILATERAL_FOCUS",
    "MULTILATERAL_FOCUS",
    "TRADE_FACILITATION",
    "COMPETITIVE_MARKETS",
  ],
  Innovation: [
    "RD_INVESTMENT",
    "TECH_TRANSFER",
    "STARTUP_ECOSYSTEM",
    "PATENT_PROTECTION",
    "OPEN_INNOVATION",
    "UNIVERSITY_PARTNERSHIPS",
    "VENTURE_CAPITAL",
    "INTELLECTUAL_PROPERTY",
    "RESEARCH_AND_DEVELOPMENT",
  ],
  "Resource Management": [
    "SUSTAINABLE_DEVELOPMENT",
    "EXTRACTION_FOCUSED",
    "RENEWABLE_ENERGY",
    "CIRCULAR_ECONOMY",
    "LINEAR_ECONOMY",
    "CONSERVATION_FIRST",
    "GREEN_TECHNOLOGY",
    "CARBON_NEUTRAL",
    "CARBON_INTENSIVE",
    "ECO_FRIENDLY",
    "GREEN_ECONOMY",
  ],
} as const;

export const COMPLEXITY_LEVELS = ["Low", "Medium", "High"] as const;

export const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-red-400",
};

export const COLOR_OPTIONS = [
  "emerald",
  "green",
  "blue",
  "purple",
  "amber",
  "orange",
  "pink",
  "indigo",
] as const;

export interface ComponentFormData {
  type: EconomicComponentType;
  name: string;
  description: string;
  category: string;
  effectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  synergies: EconomicComponentType[];
  conflicts: EconomicComponentType[];
  governmentSynergies: string[];
  governmentConflicts: string[];
  taxImpact: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
  };
  sectorImpact: {
    services: number;
    finance: number;
    technology: number;
    manufacturing: number;
    agriculture: number;
    government: number;
  };
  employmentImpact: {
    unemploymentModifier: number;
    participationModifier: number;
    wageGrowthModifier: number;
  };
  complexity: "Low" | "Medium" | "High";
  timeToImplement: string;
  staffRequired: number;
  technologyRequired: boolean;
  color: string;
  icon: string;
}

export function defaultEconomicComponentFormData(): ComponentFormData {
  return {
    type: EconomicComponentType.FREE_MARKET_SYSTEM,
    name: "",
    description: "",
    category: "Economic Model",
    effectiveness: 75,
    implementationCost: 500000,
    maintenanceCost: 100000,
    requiredCapacity: 75,
    synergies: [],
    conflicts: [],
    governmentSynergies: [],
    governmentConflicts: [],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 25,
      revenueEfficiency: 75,
    },
    sectorImpact: {
      services: 1.0,
      finance: 1.0,
      technology: 1.0,
      manufacturing: 1.0,
      agriculture: 1.0,
      government: 1.0,
    },
    employmentImpact: {
      unemploymentModifier: 0,
      participationModifier: 1.0,
      wageGrowthModifier: 1.0,
    },
    complexity: "Medium",
    timeToImplement: "12 months",
    staffRequired: 25,
    technologyRequired: false,
    color: "emerald",
    icon: "Factory",
  };
}

export function economicComponentToFormData(component: any): ComponentFormData {
  return {
    type: component.type,
    name: component.name || "",
    description: component.description || "",
    category: component.category || "Economic Model",
    effectiveness: component.effectiveness ?? 75,
    implementationCost: component.implementationCost ?? 500000,
    maintenanceCost: component.maintenanceCost ?? 100000,
    requiredCapacity: component.requiredCapacity ?? 75,
    synergies: Array.isArray(component.synergies) ? [...component.synergies] : [],
    conflicts: Array.isArray(component.conflicts) ? [...component.conflicts] : [],
    governmentSynergies: Array.isArray(component.governmentSynergies) ? [...component.governmentSynergies] : [],
    governmentConflicts: Array.isArray(component.governmentConflicts) ? [...component.governmentConflicts] : [],
    taxImpact: component.taxImpact ? { ...component.taxImpact } : {
      optimalCorporateRate: 20,
      optimalIncomeRate: 25,
      revenueEfficiency: 75,
    },
    sectorImpact: component.sectorImpact ? { ...component.sectorImpact } : {
      services: 1.0,
      finance: 1.0,
      technology: 1.0,
      manufacturing: 1.0,
      agriculture: 1.0,
      government: 1.0,
    },
    employmentImpact: component.employmentImpact ? { ...component.employmentImpact } : {
      unemploymentModifier: 0,
      participationModifier: 1.0,
      wageGrowthModifier: 1.0,
    },
    complexity: component.metadata?.complexity || "Medium",
    timeToImplement: component.metadata?.timeToImplement || "12 months",
    staffRequired: component.metadata?.staffRequired ?? 25,
    technologyRequired: component.metadata?.technologyRequired ?? false,
    color: component.color || "emerald",
    icon: component.icon || "Factory",
  };
}

export function filterEconomicComponents(
  components: any[] | undefined,
  searchTerm: string,
  categoryFilter: string,
  complexityFilter: string
): any[] {
  if (!components) return [];

  const lowerSearch = searchTerm.toLowerCase();

  return components.filter((component) => {
    const matchesSearch =
      !searchTerm ||
      component.name?.toLowerCase().includes(lowerSearch) ||
      component.description?.toLowerCase().includes(lowerSearch);

    const matchesCategory = categoryFilter === "all" || component.category === categoryFilter;

    const matchesComplexity =
      complexityFilter === "all" || component.metadata?.complexity === complexityFilter;

    return matchesSearch && matchesCategory && matchesComplexity;
  });
}
