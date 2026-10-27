/**
 * Atomic Economic Components - Part 6
 *
 * Contains Resource Management components:
 * - Throwaway production
 * - Nature protection first
 * - Clean technology industry
 * - Net zero emissions
 * - Fossil fuel power
 * - Everyday green rules
 * - Green economy
 *
 * @module atomic-economic-data/components-part6
 */

import { FireFlame, Flash, Flower, Leaf, Trash, Tree, Wind } from "iconoir-react";
import {
  EconomicComponentType,
  EconomicCategory,
  formatComponentName,
  type AtomicEconomicComponent,
} from "./types";

export const ATOMIC_ECONOMIC_COMPONENTS_PART_6: Partial<
  Record<EconomicComponentType, AtomicEconomicComponent>
> = {
  [EconomicComponentType.LINEAR_ECONOMY]: {
    id: "linear_economy",
    type: EconomicComponentType.LINEAR_ECONOMY,
    name: formatComponentName(EconomicComponentType.LINEAR_ECONOMY),
    description: "Make, use and dispose production with little recycling or reuse",
    effectiveness: 66,
    synergies: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.CARBON_INTENSIVE],
    conflicts: [
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.ECO_FRIENDLY,
      EconomicComponentType.GREEN_ECONOMY,
    ],
    governmentSynergies: ["PRIVATE_SECTOR_LEADERSHIP", "MINIMAL_GOVERNMENT"],
    governmentConflicts: ["ENVIRONMENTAL_PROTECTION", "ENVIRONMENTAL_FOCUS"],
    taxImpact: {
      optimalCorporateRate: 24,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.66,
    },
    sectorImpact: {
      manufacturing: 1.3,
      mining: 1.3,
      utilities: 1.1,
      services: 1.0,
      technology: 0.8,
    },
    employmentImpact: {
      unemploymentModifier: -0.3,
      participationModifier: 1.0,
      wageGrowthModifier: 0.9,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 0.95,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 30000,
    maintenanceCost: 20000,
    requiredCapacity: 45,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Trash,
    color: "teal",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.CONSERVATION_FIRST]: {
    id: "conservation_first",
    type: EconomicComponentType.CONSERVATION_FIRST,
    name: formatComponentName(EconomicComponentType.CONSERVATION_FIRST),
    description: "Protected land and sea areas take priority over resource use and development",
    effectiveness: 78,
    synergies: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.TOURISM_BASED,
      EconomicComponentType.ECO_FRIENDLY,
      EconomicComponentType.CARBON_NEUTRAL,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.REAL_ESTATE_FOCUSED,
      EconomicComponentType.CARBON_INTENSIVE,
    ],
    governmentSynergies: [
      "ENVIRONMENTAL_PROTECTION",
      "ENVIRONMENTAL_FOCUS",
      "CULTURAL_PRESERVATION",
    ],
    governmentConflicts: ["RESOURCE_BASED_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 23,
      optimalIncomeRate: 29,
      revenueEfficiency: 0.78,
    },
    sectorImpact: {
      services: 1.2,
      government: 1.1,
      utilities: 1.0,
      agriculture: 0.9,
      construction: 0.8,
      mining: 0.4,
    },
    employmentImpact: {
      unemploymentModifier: 0.2,
      participationModifier: 1.0,
      wageGrowthModifier: 1.0,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.1,
      literacyModifier: 1.0,
      urbanizationModifier: 0.9,
    },
    implementationCost: 90000,
    maintenanceCost: 50000,
    requiredCapacity: 65,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Tree,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.GREEN_TECHNOLOGY]: {
    id: "green_technology",
    type: EconomicComponentType.GREEN_TECHNOLOGY,
    name: formatComponentName(EconomicComponentType.GREEN_TECHNOLOGY),
    description:
      "Domestic industry building clean energy, efficient machines and low-pollution products",
    effectiveness: 86,
    synergies: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
      EconomicComponentType.CARBON_NEUTRAL,
      EconomicComponentType.GREEN_ECONOMY,
    ],
    conflicts: [EconomicComponentType.EXTRACTION_FOCUSED, EconomicComponentType.CARBON_INTENSIVE],
    governmentSynergies: [
      "ENVIRONMENTAL_PROTECTION",
      "INNOVATION_ECOSYSTEM",
      "RESEARCH_AND_DEVELOPMENT",
    ],
    governmentConflicts: ["RESOURCE_BASED_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.86,
    },
    sectorImpact: {
      renewable_energy: 2.0,
      technology: 1.7,
      manufacturing: 1.4,
      utilities: 1.4,
      mining: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: -1.3,
      participationModifier: 1.2,
      wageGrowthModifier: 1.4,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.05,
      literacyModifier: 1.05,
      urbanizationModifier: 1.05,
    },
    implementationCost: 200000,
    maintenanceCost: 100000,
    requiredCapacity: 88,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Flash,
    color: "green",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 170,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.CARBON_NEUTRAL]: {
    id: "carbon_neutral",
    type: EconomicComponentType.CARBON_NEUTRAL,
    name: formatComponentName(EconomicComponentType.CARBON_NEUTRAL),
    description: "A binding target to bring net greenhouse gas emissions to zero",
    effectiveness: 80,
    synergies: [
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.CONSERVATION_FIRST,
      EconomicComponentType.GREEN_ECONOMY,
    ],
    conflicts: [EconomicComponentType.CARBON_INTENSIVE, EconomicComponentType.EXTRACTION_FOCUSED],
    governmentSynergies: ["ENVIRONMENTAL_PROTECTION", "ENVIRONMENTAL_FOCUS", "STRATEGIC_PLANNING"],
    governmentConflicts: ["RESOURCE_BASED_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 24,
      optimalIncomeRate: 31,
      revenueEfficiency: 0.8,
    },
    sectorImpact: {
      renewable_energy: 2.2,
      utilities: 1.5,
      technology: 1.3,
      manufacturing: 0.9,
      transportation: 0.9,
      mining: 0.3,
    },
    employmentImpact: {
      unemploymentModifier: -0.4,
      participationModifier: 1.05,
      wageGrowthModifier: 1.05,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.1,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 250000,
    maintenanceCost: 120000,
    requiredCapacity: 90,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Wind,
    color: "emerald",
    metadata: {
      complexity: "High",
      timeToImplement: "4-5 years",
      staffRequired: 300,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.CARBON_INTENSIVE]: {
    id: "carbon_intensive",
    type: EconomicComponentType.CARBON_INTENSIVE,
    name: formatComponentName(EconomicComponentType.CARBON_INTENSIVE),
    description: "Energy and industry powered mainly by coal, oil and gas",
    effectiveness: 68,
    synergies: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.LINEAR_ECONOMY,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
    ],
    conflicts: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.CARBON_NEUTRAL,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.CONSERVATION_FIRST,
      EconomicComponentType.HEALTHCARE_FOCUSED,
      EconomicComponentType.TOURISM_BASED,
      EconomicComponentType.GREEN_ECONOMY,
      EconomicComponentType.ECO_FRIENDLY,
    ],
    governmentSynergies: ["RESOURCE_BASED_ECONOMY", "STATE_CAPITALISM"],
    governmentConflicts: ["ENVIRONMENTAL_PROTECTION", "ENVIRONMENTAL_FOCUS"],
    taxImpact: {
      optimalCorporateRate: 25,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.68,
    },
    sectorImpact: {
      mining: 1.8,
      utilities: 1.5,
      manufacturing: 1.4,
      transportation: 1.2,
      services: 0.9,
      renewable_energy: 0.3,
    },
    employmentImpact: {
      unemploymentModifier: -0.5,
      participationModifier: 1.0,
      wageGrowthModifier: 0.95,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 0.9,
      literacyModifier: 1.0,
      urbanizationModifier: 1.1,
    },
    implementationCost: 50000,
    maintenanceCost: 35000,
    requiredCapacity: 50,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: FireFlame,
    color: "amber",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.ECO_FRIENDLY]: {
    id: "eco_friendly",
    type: EconomicComponentType.ECO_FRIENDLY,
    name: formatComponentName(EconomicComponentType.ECO_FRIENDLY),
    description: "Everyday environmental standards for waste, packaging and pollution",
    effectiveness: 79,
    synergies: [
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.CONSERVATION_FIRST,
      EconomicComponentType.GREEN_ECONOMY,
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    ],
    conflicts: [EconomicComponentType.LINEAR_ECONOMY, EconomicComponentType.CARBON_INTENSIVE],
    governmentSynergies: ["ENVIRONMENTAL_PROTECTION", "CITIZEN_ENGAGEMENT", "SOCIAL_PRESSURE"],
    governmentConflicts: ["MINIMAL_GOVERNMENT"],
    taxImpact: {
      optimalCorporateRate: 23,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.79,
    },
    sectorImpact: {
      renewable_energy: 1.4,
      services: 1.1,
      agriculture: 1.1,
      utilities: 1.1,
      manufacturing: 0.95,
    },
    employmentImpact: {
      unemploymentModifier: -0.2,
      participationModifier: 1.0,
      wageGrowthModifier: 1.05,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.1,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 60000,
    maintenanceCost: 35000,
    requiredCapacity: 60,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Flower,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.GREEN_ECONOMY]: {
    id: "green_economy",
    type: EconomicComponentType.GREEN_ECONOMY,
    name: formatComponentName(EconomicComponentType.GREEN_ECONOMY),
    description:
      "A national strategy that shifts the whole economy toward clean industry and green jobs",
    effectiveness: 84,
    synergies: [
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.CARBON_NEUTRAL,
      EconomicComponentType.ECO_FRIENDLY,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    ],
    conflicts: [
      EconomicComponentType.CARBON_INTENSIVE,
      EconomicComponentType.LINEAR_ECONOMY,
      EconomicComponentType.EXTRACTION_FOCUSED,
    ],
    governmentSynergies: ["ENVIRONMENTAL_FOCUS", "ENVIRONMENTAL_PROTECTION", "STRATEGIC_PLANNING"],
    governmentConflicts: ["RESOURCE_BASED_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.84,
    },
    sectorImpact: {
      renewable_energy: 2.2,
      utilities: 1.5,
      technology: 1.4,
      manufacturing: 1.2,
      agriculture: 1.1,
      mining: 0.5,
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.15,
      wageGrowthModifier: 1.2,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.1,
      literacyModifier: 1.05,
      urbanizationModifier: 1.05,
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: "emerald",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 170,
      technologyRequired: true,
    },
  },
};
