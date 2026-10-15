/**
 * Atomic Economic Components - Part 7
 *
 * Contains components moved out of parts 2 and 5 to keep each file small:
 * - Export-led growth
 * - Startup investment funds
 * - Copyright and trademarks
 * - Public research institutes
 *
 * @module atomic-economic-data/components-part7
 */

import { Shield, ArrowSeparateVertical as ArrowUpDown, Cash, Microscope } from "iconoir-react";
import {
  EconomicComponentType,
  EconomicCategory,
  formatComponentName,
  type AtomicEconomicComponent,
} from "./types";

export const ATOMIC_ECONOMIC_COMPONENTS_PART_7: Partial<
  Record<EconomicComponentType, AtomicEconomicComponent>
> = {
  [EconomicComponentType.EXPORT_ORIENTED]: {
    id: "export_oriented",
    type: EconomicComponentType.EXPORT_ORIENTED,
    name: formatComponentName(EconomicComponentType.EXPORT_ORIENTED),
    description: "Focus on producing goods and services for international markets",
    effectiveness: 80,
    synergies: [
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.EXPORT_SUBSIDY,
      EconomicComponentType.TRADE_BLOC,
      EconomicComponentType.TRADE_FACILITATION,
      EconomicComponentType.EXTRACTION_FOCUSED,
    ],
    conflicts: [
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.TOURISM_BASED,
      EconomicComponentType.IMPORT_SUBSTITUTION,
    ],
    governmentSynergies: ["EXPORT_PROMOTION", "TRADE_AGREEMENTS", "INTERNATIONAL_MARKETING"],
    governmentConflicts: ["PROTECTIONIST_POLICY", "DOMESTIC_FOCUS"],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.8,
    },
    sectorImpact: {
      manufacturing: 1.6,
      agriculture: 1.4,
      services: 1.2,
      technology: 1.3,
      finance: 1.1,
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.2,
      wageGrowthModifier: 1.2,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 110000,
    maintenanceCost: 60000,
    requiredCapacity: 80,
    category: EconomicCategory.TRADE_POLICY,
    icon: ArrowUpDown,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.VENTURE_CAPITAL]: {
    id: "venture_capital",
    type: EconomicComponentType.VENTURE_CAPITAL,
    name: formatComponentName(EconomicComponentType.VENTURE_CAPITAL),
    description: "Deep pools of private investment for high-risk, high-growth companies",
    effectiveness: 86,
    synergies: [
      EconomicComponentType.STARTUP_ECOSYSTEM,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.PATENT_PROTECTION,
    ],
    conflicts: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.STATE_CAPITALISM],
    governmentSynergies: [
      "STARTUP_INCUBATION",
      "ENTREPRENEURSHIP_SUPPORT",
      "PRIVATE_SECTOR_LEADERSHIP",
    ],
    governmentConflicts: ["ECONOMIC_PLANNING", "CENTRALIZED_POWER"],
    taxImpact: {
      optimalCorporateRate: 17,
      optimalIncomeRate: 27,
      revenueEfficiency: 0.86,
    },
    sectorImpact: {
      technology: 1.9,
      finance: 1.8,
      professional: 1.5,
      services: 1.2,
      manufacturing: 1.0,
      agriculture: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: -1.5,
      participationModifier: 1.3,
      wageGrowthModifier: 1.5,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 150000,
    maintenanceCost: 70000,
    requiredCapacity: 85,
    category: EconomicCategory.INNOVATION,
    icon: Cash,
    color: "emerald",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 170,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.INTELLECTUAL_PROPERTY]: {
    id: "intellectual_property",
    type: EconomicComponentType.INTELLECTUAL_PROPERTY,
    name: formatComponentName(EconomicComponentType.INTELLECTUAL_PROPERTY),
    description: "Copyright, trademark and design protection for creative and branded work",
    effectiveness: 83,
    synergies: [
      EconomicComponentType.PATENT_PROTECTION,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.RULE_OF_LAW,
    ],
    conflicts: [EconomicComponentType.OPEN_INNOVATION],
    governmentSynergies: ["INTELLECTUAL_PROPERTY", "RULE_OF_LAW", "INDEPENDENT_JUDICIARY"],
    governmentConflicts: ["ECONOMIC_PLANNING"],
    taxImpact: {
      optimalCorporateRate: 19,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.83,
    },
    sectorImpact: {
      information: 1.6,
      technology: 1.5,
      professional: 1.5,
      services: 1.2,
      manufacturing: 1.1,
    },
    employmentImpact: {
      unemploymentModifier: -0.9,
      participationModifier: 1.1,
      wageGrowthModifier: 1.3,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 85000,
    maintenanceCost: 45000,
    requiredCapacity: 76,
    category: EconomicCategory.INNOVATION,
    icon: Shield,
    color: "purple",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.RESEARCH_AND_DEVELOPMENT]: {
    id: "research_and_development",
    type: EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
    name: formatComponentName(EconomicComponentType.RESEARCH_AND_DEVELOPMENT),
    description: "Publicly funded research institutes doing long-term basic and applied research",
    effectiveness: 88,
    synergies: [
      EconomicComponentType.RD_INVESTMENT,
      EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.OPEN_INNOVATION,
      EconomicComponentType.GREEN_TECHNOLOGY,
    ],
    conflicts: [EconomicComponentType.RESOURCE_BASED_ECONOMY],
    governmentSynergies: [
      "RESEARCH_AND_DEVELOPMENT",
      "INNOVATION_ECOSYSTEM",
      "TECHNOCRATIC_AGENCIES",
    ],
    governmentConflicts: ["MINIMAL_GOVERNMENT"],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.88,
    },
    sectorImpact: {
      technology: 1.9,
      education: 1.7,
      professional: 1.6,
      healthcare: 1.5,
      manufacturing: 1.3,
      government: 1.2,
      agriculture: 0.9,
    },
    employmentImpact: {
      unemploymentModifier: -1.6,
      participationModifier: 1.3,
      wageGrowthModifier: 1.5,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.05,
      literacyModifier: 1.1,
      urbanizationModifier: 1.05,
    },
    implementationCost: 240000,
    maintenanceCost: 130000,
    requiredCapacity: 92,
    category: EconomicCategory.INNOVATION,
    icon: Microscope,
    color: "indigo",
    metadata: {
      complexity: "High",
      timeToImplement: "4-5 years",
      staffRequired: 300,
      technologyRequired: true,
    },
  },
};
