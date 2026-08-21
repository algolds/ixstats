/**
 * Pure transforms, constants, and utilities for Government Components admin
 */

import { ComponentType } from "~/lib/enums";

export const COMPONENT_CATEGORIES = {
  "Power Distribution": [
    "CENTRALIZED_POWER",
    "FEDERAL_SYSTEM",
    "CONFEDERATE_SYSTEM",
    "UNITARY_SYSTEM",
  ],
  "Decision Process": [
    "DEMOCRATIC_PROCESS",
    "AUTOCRATIC_PROCESS",
    "TECHNOCRATIC_PROCESS",
    "CONSENSUS_PROCESS",
    "OLIGARCHIC_PROCESS",
  ],
  "Legitimacy Sources": [
    "ELECTORAL_LEGITIMACY",
    "TRADITIONAL_LEGITIMACY",
    "PERFORMANCE_LEGITIMACY",
    "CHARISMATIC_LEGITIMACY",
    "RELIGIOUS_LEGITIMACY",
    "INSTITUTIONAL_LEGITIMACY",
  ],
  Institutions: [
    "PROFESSIONAL_BUREAUCRACY",
    "MILITARY_ADMINISTRATION",
    "INDEPENDENT_JUDICIARY",
    "PARTISAN_INSTITUTIONS",
    "TECHNOCRATIC_AGENCIES",
  ],
  "Control Mechanisms": [
    "RULE_OF_LAW",
    "SURVEILLANCE_SYSTEM",
    "ECONOMIC_INCENTIVES",
    "SOCIAL_PRESSURE",
    "MILITARY_ENFORCEMENT",
  ],
  "Economic Governance": [
    "FREE_MARKET_SYSTEM",
    "PLANNED_ECONOMY",
    "MIXED_ECONOMY",
    "CORPORATIST_SYSTEM",
    "SOCIAL_MARKET_ECONOMY",
    "STATE_CAPITALISM",
    "RESOURCE_BASED_ECONOMY",
    "KNOWLEDGE_ECONOMY",
  ],
  "Administrative Efficiency": [
    "DIGITAL_GOVERNMENT",
    "E_GOVERNANCE",
    "ADMINISTRATIVE_DECENTRALIZATION",
    "MERIT_BASED_SYSTEM",
    "PERFORMANCE_MANAGEMENT",
    "QUALITY_ASSURANCE",
    "STRATEGIC_PLANNING",
    "RISK_MANAGEMENT",
  ],
  "Social Policy": [
    "WELFARE_STATE",
    "UNIVERSAL_HEALTHCARE",
    "PUBLIC_EDUCATION",
    "SOCIAL_SAFETY_NET",
    "WORKER_PROTECTION",
    "ENVIRONMENTAL_PROTECTION",
    "CULTURAL_PRESERVATION",
    "MINORITY_RIGHTS",
  ],
  "International Relations": [
    "MULTILATERAL_DIPLOMACY",
    "BILATERAL_RELATIONS",
    "REGIONAL_INTEGRATION",
    "INTERNATIONAL_LAW",
    "DEVELOPMENT_AID",
    "HUMANITARIAN_INTERVENTION",
    "TRADE_AGREEMENTS",
    "SECURITY_ALLIANCES",
  ],
  "Innovation & Development": [
    "RESEARCH_AND_DEVELOPMENT",
    "INNOVATION_ECOSYSTEM",
    "TECHNOLOGY_TRANSFER",
    "ENTREPRENEURSHIP_SUPPORT",
  ],
} as const;

export const COMPLEXITY_LEVELS = ["Low", "Medium", "High"] as const;

export const COMPLEXITY_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-red-400",
};

export const COLOR_OPTIONS = [
  "blue",
  "green",
  "red",
  "purple",
  "amber",
  "orange",
  "pink",
  "indigo",
] as const;

export interface ComponentFormData {
  type: ComponentType;
  name: string;
  description: string;
  category: string;
  effectiveness: number;
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  synergies: ComponentType[];
  conflicts: ComponentType[];
  complexity: "Low" | "Medium" | "High";
  timeToImplement: string;
  staffRequired: number;
  technologyRequired: boolean;
  color: string;
  icon: string;
}

export function defaultGovernmentComponentFormData(): ComponentFormData {
  return {
    type: ComponentType.CENTRALIZED_POWER,
    name: "",
    description: "",
    category: "Power Distribution",
    effectiveness: 75,
    implementationCost: 500000,
    maintenanceCost: 100000,
    requiredCapacity: 75,
    synergies: [],
    conflicts: [],
    complexity: "Medium",
    timeToImplement: "12 months",
    staffRequired: 25,
    technologyRequired: false,
    color: "blue",
    icon: "Building2",
  };
}

export function governmentComponentToFormData(component: any): ComponentFormData {
  return {
    type: component.type,
    name: component.name || "",
    description: component.description || "",
    category: component.category || "Power Distribution",
    effectiveness: component.effectiveness ?? 75,
    implementationCost: component.implementationCost ?? 500000,
    maintenanceCost: component.maintenanceCost ?? 100000,
    requiredCapacity: component.requiredCapacity ?? 75,
    synergies: Array.isArray(component.synergies) ? [...component.synergies] : [],
    conflicts: Array.isArray(component.conflicts) ? [...component.conflicts] : [],
    complexity: component.metadata?.complexity || "Medium",
    timeToImplement: component.metadata?.timeToImplement || "12 months",
    staffRequired: component.metadata?.staffRequired ?? 25,
    technologyRequired: component.metadata?.technologyRequired ?? false,
    color: component.color || "blue",
    icon: component.icon || "Building2",
  };
}

export function filterGovernmentComponents(
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
