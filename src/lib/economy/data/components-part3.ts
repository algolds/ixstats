/**
 * Atomic Economic Components - Part 3
 *
 * Contains Innovation and Resource Management components:
 * - R&D Investment
 * - Startup Ecosystem
 * - University Partnerships
 * - Sustainable Development
 * - Extraction-Focused Economy
 * - Renewable Energy
 * - Circular Economy
 *
 * @module atomic-economic-data/components-part3
 */

import {
  LightBulb as Lightbulb,
  Flash as Zap,
  GraduationCap,
  Leaf,
  Wrench,
} from "iconoir-react";
import {
  EconomicComponentType,
  EconomicCategory,
  formatComponentName,
  type AtomicEconomicComponent,
} from "./types";

export const ATOMIC_ECONOMIC_COMPONENTS_PART_3: Partial<
  Record<EconomicComponentType, AtomicEconomicComponent>
> = {
  [EconomicComponentType.RD_INVESTMENT]: {
    id: "rd_investment",
    type: EconomicComponentType.RD_INVESTMENT,
    name: formatComponentName(EconomicComponentType.RD_INVESTMENT),
    description: "High investment in research and development activities",
    effectiveness: 90,
    synergies: [
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
    ],
    governmentSynergies: [
      "RESEARCH_AND_DEVELOPMENT",
      "INNOVATION_ECOSYSTEM",
      "SCIENTIFIC_RESEARCH",
    ],
    governmentConflicts: ["TRADITIONAL_ECONOMY", "RESOURCE_EXTRACTION"],
    taxImpact: {
      optimalCorporateRate: 16,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.9,
    },
    sectorImpact: {
      technology: 2.2,
      professional: 1.8,
      education: 1.9,
      manufacturing: 1.3,
      healthcare: 1.6,
      agriculture: 0.7,
    },
    employmentImpact: {
      unemploymentModifier: -2.0,
      participationModifier: 1.4,
      wageGrowthModifier: 1.7,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 250000,
    maintenanceCost: 125000,
    requiredCapacity: 95,
    category: EconomicCategory.INNOVATION,
    icon: Lightbulb,
    color: "amber",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.STARTUP_ECOSYSTEM]: {
    id: "startup_ecosystem",
    type: EconomicComponentType.STARTUP_ECOSYSTEM,
    name: formatComponentName(EconomicComponentType.STARTUP_ECOSYSTEM),
    description: "Supportive environment for new business creation and growth",
    effectiveness: 87,
    synergies: [
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.VENTURE_CAPITAL,
      EconomicComponentType.FLEXIBLE_LABOR,
    ],
    conflicts: [
      EconomicComponentType.PLANNED_ECONOMY,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.STATE_CAPITALISM,
    ],
    governmentSynergies: ["STARTUP_INCUBATION", "ENTREPRENEURSHIP_SUPPORT", "INNOVATION_ECOSYSTEM"],
    governmentConflicts: ["PLANNED_ECONOMY", "CENTRALIZED_CONTROL"],
    taxImpact: {
      optimalCorporateRate: 17,
      optimalIncomeRate: 27,
      revenueEfficiency: 0.87,
    },
    sectorImpact: {
      technology: 2.0,
      professional: 1.7,
      finance: 1.5,
      services: 1.3,
      manufacturing: 1.1,
      agriculture: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: -1.8,
      participationModifier: 1.4,
      wageGrowthModifier: 1.6,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: EconomicCategory.INNOVATION,
    icon: Zap,
    color: "cyan",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 170,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.UNIVERSITY_PARTNERSHIPS]: {
    id: "university_partnerships",
    type: EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
    name: formatComponentName(EconomicComponentType.UNIVERSITY_PARTNERSHIPS),
    description: "Strong collaboration between universities and industry",
    effectiveness: 86,
    synergies: [
      EconomicComponentType.EDUCATION_FIRST,
      EconomicComponentType.RD_INVESTMENT,
      EconomicComponentType.TECH_TRANSFER,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
    ],
    governmentSynergies: [
      "UNIVERSITY_PARTNERSHIPS",
      "RESEARCH_AND_DEVELOPMENT",
      "EDUCATION_SYSTEM",
    ],
    governmentConflicts: ["TRADITIONAL_ECONOMY", "RESOURCE_EXTRACTION"],
    taxImpact: {
      optimalCorporateRate: 19,
      optimalIncomeRate: 29,
      revenueEfficiency: 0.86,
    },
    sectorImpact: {
      education: 2.0,
      technology: 1.9,
      professional: 1.8,
      healthcare: 1.6,
      manufacturing: 1.2,
      agriculture: 0.8,
    },
    employmentImpact: {
      unemploymentModifier: -1.6,
      participationModifier: 1.3,
      wageGrowthModifier: 1.5,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 160000,
    maintenanceCost: 80000,
    requiredCapacity: 88,
    category: EconomicCategory.INNOVATION,
    icon: GraduationCap,
    color: "purple",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 180,
      technologyRequired: true,
    },
  },

  // Resource Management Components
  [EconomicComponentType.SUSTAINABLE_DEVELOPMENT]: {
    id: "sustainable_development",
    type: EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    name: formatComponentName(EconomicComponentType.SUSTAINABLE_DEVELOPMENT),
    description: "Development that meets present needs without compromising future generations",
    effectiveness: 83,
    synergies: [
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.GREEN_TECHNOLOGY,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.CARBON_INTENSIVE,
    ],
    governmentSynergies: ["ENVIRONMENTAL_PROTECTION", "SUSTAINABLE_DEVELOPMENT", "GREEN_POLICY"],
    governmentConflicts: ["RESOURCE_EXTRACTION", "CARBON_INTENSIVE_INDUSTRY"],
    taxImpact: {
      optimalCorporateRate: 23,
      optimalIncomeRate: 31,
      revenueEfficiency: 0.83,
    },
    sectorImpact: {
      renewable_energy: 2.0,
      technology: 1.4,
      manufacturing: 1.1,
      agriculture: 1.2,
      mining: 0.6,
      utilities: 1.3,
    },
    employmentImpact: {
      unemploymentModifier: -0.8,
      participationModifier: 1.1,
      wageGrowthModifier: 1.2,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 140000,
    maintenanceCost: 70000,
    requiredCapacity: 82,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.EXTRACTION_FOCUSED]: {
    id: "extraction_focused",
    type: EconomicComponentType.EXTRACTION_FOCUSED,
    name: formatComponentName(EconomicComponentType.EXTRACTION_FOCUSED),
    description: "Economy centered on natural resource extraction and processing",
    effectiveness: 72,
    synergies: [
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.MANUFACTURING_LED,
    ],
    conflicts: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.GREEN_TECHNOLOGY,
    ],
    governmentSynergies: ["RESOURCE_EXTRACTION", "MINING_INDUSTRY", "EXPORT_ORIENTED"],
    governmentConflicts: ["ENVIRONMENTAL_PROTECTION", "SUSTAINABLE_DEVELOPMENT"],
    taxImpact: {
      optimalCorporateRate: 32,
      optimalIncomeRate: 34,
      revenueEfficiency: 0.72,
    },
    sectorImpact: {
      mining: 2.5,
      manufacturing: 1.3,
      utilities: 1.4,
      agriculture: 1.0,
      technology: 0.6,
      services: 0.7,
    },
    employmentImpact: {
      unemploymentModifier: 1.2,
      participationModifier: 0.9,
      wageGrowthModifier: 0.9,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 95000,
    maintenanceCost: 55000,
    requiredCapacity: 70,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Wrench,
    color: "teal",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.RENEWABLE_ENERGY]: {
    id: "renewable_energy",
    type: EconomicComponentType.RENEWABLE_ENERGY,
    name: formatComponentName(EconomicComponentType.RENEWABLE_ENERGY),
    description: "Focus on renewable energy sources and clean technology",
    effectiveness: 85,
    synergies: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.CIRCULAR_ECONOMY,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.CARBON_INTENSIVE,
    ],
    governmentSynergies: ["RENEWABLE_ENERGY", "ENVIRONMENTAL_PROTECTION", "GREEN_TECHNOLOGY"],
    governmentConflicts: ["FOSSIL_FUEL_INDUSTRY", "CARBON_INTENSIVE_POLICY"],
    taxImpact: {
      optimalCorporateRate: 21,
      optimalIncomeRate: 29,
      revenueEfficiency: 0.85,
    },
    sectorImpact: {
      renewable_energy: 2.8,
      technology: 1.6,
      manufacturing: 1.4,
      utilities: 1.7,
      mining: 0.4,
      services: 1.1,
    },
    employmentImpact: {
      unemploymentModifier: -1.2,
      participationModifier: 1.2,
      wageGrowthModifier: 1.3,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 85,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.CIRCULAR_ECONOMY]: {
    id: "circular_economy",
    type: EconomicComponentType.CIRCULAR_ECONOMY,
    name: formatComponentName(EconomicComponentType.CIRCULAR_ECONOMY),
    description: "Economy focused on reducing waste and reusing resources",
    effectiveness: 84,
    synergies: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.RENEWABLE_ENERGY,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.LINEAR_ECONOMY,
    ],
    governmentSynergies: ["CIRCULAR_ECONOMY", "WASTE_REDUCTION", "RESOURCE_EFFICIENCY"],
    governmentConflicts: ["LINEAR_ECONOMY", "WASTE_GENERATION"],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.84,
    },
    sectorImpact: {
      manufacturing: 1.5,
      technology: 1.6,
      utilities: 1.4,
      services: 1.2,
      mining: 0.5,
      agriculture: 1.3,
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.1,
      wageGrowthModifier: 1.2,
    },
    demographicImpact: {
      populationGrowthModifier: 1.0,
      lifeExpectancyModifier: 1.0,
      literacyModifier: 1.0,
      urbanizationModifier: 1.0,
    },
    implementationCost: 150000,
    maintenanceCost: 75000,
    requiredCapacity: 83,
    category: EconomicCategory.RESOURCE_MANAGEMENT,
    icon: Leaf,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },
};
