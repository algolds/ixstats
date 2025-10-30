/**
 * Atomic Economic Components - Data Layer
 *
 * Pure TypeScript data structures containing all economic component definitions,
 * categories, templates, and type definitions. No React dependencies.
 *
 * This file contains:
 * - Component type enums
 * - Component interfaces
 * - Full component library with all economic components
 * - Category definitions
 * - Template presets for common economic configurations
 */

import {
  Building2,
  Factory,
  Users,
  Target,
  DollarSign,
  Globe,
  Zap,
  Leaf,
  Brain,
  Wrench,
  Briefcase,
  GraduationCap,
  Heart,
  Lightbulb,
  Lock,
  Unlock,
  ArrowUpDown,
  BarChart3,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Format component type to display name
 * Converts SCREAMING_SNAKE_CASE to Title Case
 * Example: "FREE_MARKET_SYSTEM" -> "Free Market System"
 */
export function formatComponentName(componentType: string): string {
  return componentType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Economic Component Types Enum
 * Defines all available atomic economic components
 */
export enum EconomicComponentType {
  // Economic Model Components
  FREE_MARKET_SYSTEM = "FREE_MARKET_SYSTEM",
  MIXED_ECONOMY = "MIXED_ECONOMY",
  STATE_CAPITALISM = "STATE_CAPITALISM",
  PLANNED_ECONOMY = "PLANNED_ECONOMY",
  SOCIAL_MARKET_ECONOMY = "SOCIAL_MARKET_ECONOMY",
  RESOURCE_BASED_ECONOMY = "RESOURCE_BASED_ECONOMY",
  KNOWLEDGE_ECONOMY = "KNOWLEDGE_ECONOMY",
  INNOVATION_ECONOMY = "INNOVATION_ECONOMY",

  // Sector Focus Components
  AGRICULTURE_LED = "AGRICULTURE_LED",
  MANUFACTURING_LED = "MANUFACTURING_LED",
  SERVICE_BASED = "SERVICE_BASED",
  TECHNOLOGY_FOCUSED = "TECHNOLOGY_FOCUSED",
  FINANCE_CENTERED = "FINANCE_CENTERED",
  EXPORT_ORIENTED = "EXPORT_ORIENTED",
  DOMESTIC_FOCUSED = "DOMESTIC_FOCUSED",
  TOURISM_BASED = "TOURISM_BASED",

  // Labor System Components
  FLEXIBLE_LABOR = "FLEXIBLE_LABOR",
  PROTECTED_WORKERS = "PROTECTED_WORKERS",
  UNION_BASED = "UNION_BASED",
  GIG_ECONOMY = "GIG_ECONOMY",
  PROFESSIONAL_SERVICES = "PROFESSIONAL_SERVICES",
  SKILL_BASED = "SKILL_BASED",
  EDUCATION_FIRST = "EDUCATION_FIRST",
  MERIT_BASED = "MERIT_BASED",
  HIGH_SKILLED_WORKERS = "HIGH_SKILLED_WORKERS",
  EDUCATION_FOCUSED = "EDUCATION_FOCUSED",
  HEALTHCARE_FOCUSED = "HEALTHCARE_FOCUSED",
  VOCATIONAL_TRAINING = "VOCATIONAL_TRAINING",

  // Trade Policy Components
  FREE_TRADE = "FREE_TRADE",
  PROTECTIONIST = "PROTECTIONIST",
  BALANCED_TRADE = "BALANCED_TRADE",
  EXPORT_SUBSIDY = "EXPORT_SUBSIDY",
  IMPORT_SUBSTITUTION = "IMPORT_SUBSTITUTION",
  TRADE_BLOC = "TRADE_BLOC",
  BILATERAL_FOCUS = "BILATERAL_FOCUS",
  MULTILATERAL_FOCUS = "MULTILATERAL_FOCUS",
  TRADE_FACILITATION = "TRADE_FACILITATION",
  COMPETITIVE_MARKETS = "COMPETITIVE_MARKETS",

  // Innovation Components
  RD_INVESTMENT = "RD_INVESTMENT",
  TECH_TRANSFER = "TECH_TRANSFER",
  STARTUP_ECOSYSTEM = "STARTUP_ECOSYSTEM",
  PATENT_PROTECTION = "PATENT_PROTECTION",
  OPEN_INNOVATION = "OPEN_INNOVATION",
  UNIVERSITY_PARTNERSHIPS = "UNIVERSITY_PARTNERSHIPS",
  VENTURE_CAPITAL = "VENTURE_CAPITAL",
  INTELLECTUAL_PROPERTY = "INTELLECTUAL_PROPERTY",
  RESEARCH_AND_DEVELOPMENT = "RESEARCH_AND_DEVELOPMENT",

  // Resource Management Components
  SUSTAINABLE_DEVELOPMENT = "SUSTAINABLE_DEVELOPMENT",
  EXTRACTION_FOCUSED = "EXTRACTION_FOCUSED",
  RENEWABLE_ENERGY = "RENEWABLE_ENERGY",
  CIRCULAR_ECONOMY = "CIRCULAR_ECONOMY",
  LINEAR_ECONOMY = "LINEAR_ECONOMY",
  CONSERVATION_FIRST = "CONSERVATION_FIRST",
  GREEN_TECHNOLOGY = "GREEN_TECHNOLOGY",
  CARBON_NEUTRAL = "CARBON_NEUTRAL",
  CARBON_INTENSIVE = "CARBON_INTENSIVE",
  ECO_FRIENDLY = "ECO_FRIENDLY",
  GREEN_ECONOMY = "GREEN_ECONOMY",

  // Real Estate & Property Components
  REAL_ESTATE_FOCUSED = "REAL_ESTATE_FOCUSED",
  RULE_OF_LAW = "RULE_OF_LAW",
}

/**
 * Economic Component Categories
 */
export enum EconomicCategory {
  ECONOMIC_MODEL = "Economic Model",
  SECTOR_FOCUS = "Sector Focus",
  LABOR_SYSTEM = "Labor System",
  TRADE_POLICY = "Trade Policy",
  INNOVATION = "Innovation",
  RESOURCE_MANAGEMENT = "Resource Management",
}

/**
 * Atomic Economic Component Interface
 * Defines the structure of each economic component
 */
export interface AtomicEconomicComponent {
  id: string;
  type: EconomicComponentType;
  name: string;
  description: string;
  effectiveness: number;
  synergies: EconomicComponentType[];
  conflicts: EconomicComponentType[];
  governmentSynergies: string[];
  governmentConflicts: string[];
  taxImpact: {
    optimalCorporateRate: number;
    optimalIncomeRate: number;
    revenueEfficiency: number;
  };
  sectorImpact: Record<string, number>;
  employmentImpact: {
    unemploymentModifier: number;
    participationModifier: number;
    wageGrowthModifier: number;
  };
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: EconomicCategory;
  icon: LucideIcon;
  color: string;
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
}

/**
 * Economic Category Definition
 */
export interface EconomicCategoryDefinition {
  name: string;
  description: string;
  icon: LucideIcon;
  components: EconomicComponentType[];
}

// ============================================================================
// Component Library
// ============================================================================

/**
 * Atomic Economic Component Library
 * Complete catalog of all available economic components
 */
export const ATOMIC_ECONOMIC_COMPONENTS: Partial<
  Record<EconomicComponentType, AtomicEconomicComponent>
> = {
  // Economic Model Components
  [EconomicComponentType.FREE_MARKET_SYSTEM]: {
    id: "free_market_system",
    type: EconomicComponentType.FREE_MARKET_SYSTEM,
    name: formatComponentName(EconomicComponentType.FREE_MARKET_SYSTEM),
    description: "Minimal government intervention, market-driven resource allocation",
    effectiveness: 85,
    synergies: [
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.STARTUP_ECOSYSTEM,
    ],
    conflicts: [
      EconomicComponentType.PLANNED_ECONOMY,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.PROTECTIONIST,
    ],
    governmentSynergies: ["FREE_MARKET_SYSTEM", "MINIMAL_GOVERNMENT", "PRIVATE_SECTOR_LEADERSHIP"],
    governmentConflicts: ["PLANNED_ECONOMY", "STATE_CAPITALISM", "CENTRALIZED_POWER"],
    taxImpact: {
      optimalCorporateRate: 15,
      optimalIncomeRate: 25,
      revenueEfficiency: 0.85,
    },
    sectorImpact: {
      services: 1.2,
      finance: 1.3,
      technology: 1.4,
      manufacturing: 1.1,
      agriculture: 0.9,
      government: 0.7,
    },
    employmentImpact: {
      unemploymentModifier: -0.5,
      participationModifier: 1.1,
      wageGrowthModifier: 1.2,
    },
    implementationCost: 50000,
    maintenanceCost: 25000,
    requiredCapacity: 60,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: DollarSign,
    color: "emerald",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 150,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.MIXED_ECONOMY]: {
    id: "mixed_economy",
    type: EconomicComponentType.MIXED_ECONOMY,
    name: formatComponentName(EconomicComponentType.MIXED_ECONOMY),
    description: "Balance of market forces and government intervention",
    effectiveness: 78,
    synergies: [
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.PROTECTED_WORKERS,
    ],
    conflicts: [EconomicComponentType.PLANNED_ECONOMY, EconomicComponentType.FREE_MARKET_SYSTEM],
    governmentSynergies: ["MIXED_ECONOMY", "BALANCED_APPROACH", "SOCIAL_MARKET_ECONOMY"],
    governmentConflicts: ["CENTRALIZED_POWER", "AUTOCRATIC_PROCESS"],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.78,
    },
    sectorImpact: {
      services: 1.0,
      manufacturing: 1.1,
      agriculture: 1.0,
      government: 1.2,
      finance: 1.0,
      technology: 1.1,
    },
    employmentImpact: {
      unemploymentModifier: 0.0,
      participationModifier: 1.0,
      wageGrowthModifier: 1.0,
    },
    implementationCost: 75000,
    maintenanceCost: 40000,
    requiredCapacity: 70,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: BarChart3,
    color: "emerald",
    metadata: {
      complexity: "High",
      timeToImplement: "3-4 years",
      staffRequired: 200,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.STATE_CAPITALISM]: {
    id: "state_capitalism",
    type: EconomicComponentType.STATE_CAPITALISM,
    name: formatComponentName(EconomicComponentType.STATE_CAPITALISM),
    description: "Government controls strategic sectors while allowing market forces in others",
    effectiveness: 72,
    synergies: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.PLANNED_ECONOMY,
    ],
    conflicts: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.FREE_TRADE,
    ],
    governmentSynergies: ["STATE_CAPITALISM", "CENTRALIZED_POWER", "PLANNED_ECONOMY"],
    governmentConflicts: ["FREE_MARKET_SYSTEM", "DEMOCRATIC_PROCESS"],
    taxImpact: {
      optimalCorporateRate: 28,
      optimalIncomeRate: 35,
      revenueEfficiency: 0.72,
    },
    sectorImpact: {
      manufacturing: 1.3,
      government: 1.4,
      utilities: 1.5,
      finance: 0.8,
      services: 0.9,
      technology: 1.1,
    },
    employmentImpact: {
      unemploymentModifier: 1.2,
      participationModifier: 0.9,
      wageGrowthModifier: 0.8,
    },
    implementationCost: 100000,
    maintenanceCost: 60000,
    requiredCapacity: 80,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Building2,
    color: "emerald",
    metadata: {
      complexity: "High",
      timeToImplement: "4-5 years",
      staffRequired: 300,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.PLANNED_ECONOMY]: {
    id: "planned_economy",
    type: EconomicComponentType.PLANNED_ECONOMY,
    name: formatComponentName(EconomicComponentType.PLANNED_ECONOMY),
    description: "Government controls all major economic decisions and resource allocation",
    effectiveness: 65,
    synergies: [
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.IMPORT_SUBSTITUTION,
    ],
    conflicts: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.FREE_TRADE,
    ],
    governmentSynergies: ["PLANNED_ECONOMY", "CENTRALIZED_POWER", "AUTOCRATIC_PROCESS"],
    governmentConflicts: ["FREE_MARKET_SYSTEM", "DEMOCRATIC_PROCESS"],
    taxImpact: {
      optimalCorporateRate: 35,
      optimalIncomeRate: 40,
      revenueEfficiency: 0.65,
    },
    sectorImpact: {
      government: 1.6,
      manufacturing: 1.2,
      utilities: 1.4,
      agriculture: 1.1,
      finance: 0.6,
      services: 0.7,
      technology: 0.8,
    },
    employmentImpact: {
      unemploymentModifier: 1.5,
      participationModifier: 0.8,
      wageGrowthModifier: 0.7,
    },
    implementationCost: 150000,
    maintenanceCost: 80000,
    requiredCapacity: 90,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Target,
    color: "purple",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 180,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.SOCIAL_MARKET_ECONOMY]: {
    id: "social_market_economy",
    type: EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    name: formatComponentName(EconomicComponentType.SOCIAL_MARKET_ECONOMY),
    description: "Market economy with strong social safety nets and worker protections",
    effectiveness: 82,
    synergies: [
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.UNION_BASED,
      EconomicComponentType.EDUCATION_FIRST,
    ],
    conflicts: [
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.GIG_ECONOMY,
      EconomicComponentType.FREE_MARKET_SYSTEM,
    ],
    governmentSynergies: ["SOCIAL_MARKET_ECONOMY", "WELFARE_STATE", "WORKER_PROTECTION"],
    governmentConflicts: ["FREE_MARKET_SYSTEM", "MINIMAL_GOVERNMENT"],
    taxImpact: {
      optimalCorporateRate: 25,
      optimalIncomeRate: 35,
      revenueEfficiency: 0.82,
    },
    sectorImpact: {
      services: 1.1,
      education: 1.3,
      healthcare: 1.4,
      manufacturing: 1.0,
      finance: 1.0,
      government: 1.3,
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.1,
      wageGrowthModifier: 1.1,
    },
    implementationCost: 120000,
    maintenanceCost: 70000,
    requiredCapacity: 85,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Heart,
    color: "amber",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.KNOWLEDGE_ECONOMY]: {
    id: "knowledge_economy",
    type: EconomicComponentType.KNOWLEDGE_ECONOMY,
    name: formatComponentName(EconomicComponentType.KNOWLEDGE_ECONOMY),
    description: "Economy driven by knowledge, innovation, and intellectual capital",
    effectiveness: 88,
    synergies: [
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.RD_INVESTMENT,
      EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
    ],
    conflicts: [
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
    ],
    governmentSynergies: ["RESEARCH_AND_DEVELOPMENT", "EDUCATION_SYSTEM", "INNOVATION_ECOSYSTEM"],
    governmentConflicts: ["TRADITIONAL_LEGITIMACY", "RESOURCE_BASED_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.88,
    },
    sectorImpact: {
      technology: 1.8,
      professional: 1.6,
      education: 1.4,
      finance: 1.2,
      information: 1.7,
      manufacturing: 0.7,
      agriculture: 0.5,
    },
    employmentImpact: {
      unemploymentModifier: -1.5,
      participationModifier: 1.3,
      wageGrowthModifier: 1.4,
    },
    implementationCost: 200000,
    maintenanceCost: 100000,
    requiredCapacity: 95,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Brain,
    color: "cyan",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 170,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.INNOVATION_ECONOMY]: {
    id: "innovation_economy",
    type: EconomicComponentType.INNOVATION_ECONOMY,
    name: formatComponentName(EconomicComponentType.INNOVATION_ECONOMY),
    description: "Economy focused on continuous innovation and technological advancement",
    effectiveness: 90,
    synergies: [
      EconomicComponentType.STARTUP_ECOSYSTEM,
      EconomicComponentType.VENTURE_CAPITAL,
      EconomicComponentType.PATENT_PROTECTION,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.PROTECTIONIST,
    ],
    governmentSynergies: ["RESEARCH_AND_DEVELOPMENT", "INNOVATION_ECOSYSTEM", "STARTUP_INCUBATION"],
    governmentConflicts: ["TRADITIONAL_LEGITIMACY", "PLANNED_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 16,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.9,
    },
    sectorImpact: {
      technology: 2.0,
      professional: 1.8,
      information: 1.9,
      finance: 1.3,
      manufacturing: 0.8,
      agriculture: 0.4,
    },
    employmentImpact: {
      unemploymentModifier: -2.0,
      participationModifier: 1.4,
      wageGrowthModifier: 1.6,
    },
    implementationCost: 250000,
    maintenanceCost: 125000,
    requiredCapacity: 98,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Lightbulb,
    color: "amber",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.RESOURCE_BASED_ECONOMY]: {
    id: "resource_based_economy",
    type: EconomicComponentType.RESOURCE_BASED_ECONOMY,
    name: formatComponentName(EconomicComponentType.RESOURCE_BASED_ECONOMY),
    description: "Economy dependent on natural resource extraction and export",
    effectiveness: 70,
    synergies: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
    ],
    conflicts: [
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    ],
    governmentSynergies: ["RESOURCE_BASED_ECONOMY", "EXTRACTION_FOCUSED", "EXPORT_ORIENTED"],
    governmentConflicts: ["KNOWLEDGE_ECONOMY", "INNOVATION_ECOSYSTEM"],
    taxImpact: {
      optimalCorporateRate: 30,
      optimalIncomeRate: 32,
      revenueEfficiency: 0.7,
    },
    sectorImpact: {
      mining: 2.0,
      manufacturing: 1.2,
      agriculture: 1.1,
      utilities: 1.3,
      services: 0.8,
      technology: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: 1.0,
      participationModifier: 0.9,
      wageGrowthModifier: 0.9,
    },
    implementationCost: 80000,
    maintenanceCost: 45000,
    requiredCapacity: 65,
    category: EconomicCategory.ECONOMIC_MODEL,
    icon: Wrench,
    color: "teal",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  // Sector Focus Components
  [EconomicComponentType.AGRICULTURE_LED]: {
    id: "agriculture_led",
    type: EconomicComponentType.AGRICULTURE_LED,
    name: formatComponentName(EconomicComponentType.AGRICULTURE_LED),
    description: "Economy focused on agricultural production and food security",
    effectiveness: 68,
    synergies: [
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.DOMESTIC_FOCUSED,
    ],
    conflicts: [
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.FINANCE_CENTERED,
    ],
    governmentSynergies: ["AGRICULTURE", "RURAL_DEVELOPMENT", "FOOD_SECURITY"],
    governmentConflicts: ["INNOVATION_ECOSYSTEM", "DIGITAL_GOVERNMENT"],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 22,
      revenueEfficiency: 0.68,
    },
    sectorImpact: {
      agriculture: 2.5,
      manufacturing: 1.1,
      services: 0.7,
      technology: 0.5,
      finance: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: 1.2,
      participationModifier: 0.8,
      wageGrowthModifier: 0.7,
    },
    implementationCost: 60000,
    maintenanceCost: 35000,
    requiredCapacity: 55,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Leaf,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.MANUFACTURING_LED]: {
    id: "manufacturing_led",
    type: EconomicComponentType.MANUFACTURING_LED,
    name: formatComponentName(EconomicComponentType.MANUFACTURING_LED),
    description: "Economy driven by industrial production and manufacturing",
    effectiveness: 75,
    synergies: [
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.SKILL_BASED,
    ],
    conflicts: [
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.TOURISM_BASED,
    ],
    governmentSynergies: ["MANUFACTURING", "INDUSTRIAL_POLICY", "TECHNOLOGY_TRANSFER"],
    governmentConflicts: ["SERVICE_BASED_ECONOMY", "TOURISM_FOCUS"],
    taxImpact: {
      optimalCorporateRate: 24,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.75,
    },
    sectorImpact: {
      manufacturing: 2.2,
      construction: 1.4,
      utilities: 1.2,
      services: 0.8,
      technology: 1.1,
    },
    employmentImpact: {
      unemploymentModifier: -0.5,
      participationModifier: 1.1,
      wageGrowthModifier: 1.0,
    },
    implementationCost: 100000,
    maintenanceCost: 55000,
    requiredCapacity: 75,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Factory,
    color: "indigo",
    metadata: {
      complexity: "High",
      timeToImplement: "4-5 years",
      staffRequired: 300,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.SERVICE_BASED]: {
    id: "service_based",
    type: EconomicComponentType.SERVICE_BASED,
    name: formatComponentName(EconomicComponentType.SERVICE_BASED),
    description: "Economy dominated by service sector activities",
    effectiveness: 80,
    synergies: [
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.PROFESSIONAL_SERVICES,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
    ],
    conflicts: [
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.MANUFACTURING_LED,
    ],
    governmentSynergies: ["SERVICE_ECONOMY", "PROFESSIONAL_SERVICES", "KNOWLEDGE_ECONOMY"],
    governmentConflicts: ["MANUFACTURING_FOCUS", "RESOURCE_EXTRACTION"],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.8,
    },
    sectorImpact: {
      services: 2.0,
      finance: 1.6,
      professional: 1.8,
      education: 1.3,
      healthcare: 1.4,
      manufacturing: 0.6,
      agriculture: 0.4,
    },
    employmentImpact: {
      unemploymentModifier: -0.8,
      participationModifier: 1.2,
      wageGrowthModifier: 1.1,
    },
    implementationCost: 120000,
    maintenanceCost: 65000,
    requiredCapacity: 80,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Users,
    color: "purple",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 180,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.TECHNOLOGY_FOCUSED]: {
    id: "technology_focused",
    type: EconomicComponentType.TECHNOLOGY_FOCUSED,
    name: formatComponentName(EconomicComponentType.TECHNOLOGY_FOCUSED),
    description: "Economy centered on technology development and digital services",
    effectiveness: 92,
    synergies: [
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.STARTUP_ECOSYSTEM,
    ],
    conflicts: [
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
    ],
    governmentSynergies: ["DIGITAL_GOVERNMENT", "TECHNOLOGY_TRANSFER", "INNOVATION_ECOSYSTEM"],
    governmentConflicts: ["TRADITIONAL_LEGITIMACY", "RESOURCE_EXTRACTION"],
    taxImpact: {
      optimalCorporateRate: 15,
      optimalIncomeRate: 25,
      revenueEfficiency: 0.92,
    },
    sectorImpact: {
      technology: 2.5,
      information: 2.3,
      professional: 1.9,
      finance: 1.4,
      education: 1.6,
      manufacturing: 0.8,
      agriculture: 0.3,
    },
    employmentImpact: {
      unemploymentModifier: -2.5,
      participationModifier: 1.5,
      wageGrowthModifier: 1.8,
    },
    implementationCost: 300000,
    maintenanceCost: 150000,
    requiredCapacity: 95,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: Zap,
    color: "cyan",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 170,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.FINANCE_CENTERED]: {
    id: "finance_centered",
    type: EconomicComponentType.FINANCE_CENTERED,
    name: formatComponentName(EconomicComponentType.FINANCE_CENTERED),
    description: "Economy focused on financial services and banking",
    effectiveness: 85,
    synergies: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.PROFESSIONAL_SERVICES,
    ],
    conflicts: [
      EconomicComponentType.PLANNED_ECONOMY,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.AGRICULTURE_LED,
    ],
    governmentSynergies: ["FINANCIAL_REGULATION", "FREE_MARKET_SYSTEM", "PROFESSIONAL_SERVICES"],
    governmentConflicts: ["PLANNED_ECONOMY", "CENTRALIZED_POWER"],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.85,
    },
    sectorImpact: {
      finance: 2.8,
      professional: 1.9,
      services: 1.4,
      technology: 1.3,
      manufacturing: 0.5,
      agriculture: 0.3,
    },
    employmentImpact: {
      unemploymentModifier: -1.2,
      participationModifier: 1.3,
      wageGrowthModifier: 1.5,
    },
    implementationCost: 180000,
    maintenanceCost: 90000,
    requiredCapacity: 90,
    category: EconomicCategory.SECTOR_FOCUS,
    icon: DollarSign,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  // Labor System Components
  [EconomicComponentType.FLEXIBLE_LABOR]: {
    id: "flexible_labor",
    type: EconomicComponentType.FLEXIBLE_LABOR,
    name: formatComponentName(EconomicComponentType.FLEXIBLE_LABOR),
    description: "Labor market with minimal restrictions on hiring and firing",
    effectiveness: 82,
    synergies: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.GIG_ECONOMY,
      EconomicComponentType.STARTUP_ECOSYSTEM,
    ],
    conflicts: [
      EconomicComponentType.UNION_BASED,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    ],
    governmentSynergies: ["FREE_MARKET_SYSTEM", "MINIMAL_REGULATION", "ENTREPRENEURSHIP_SUPPORT"],
    governmentConflicts: ["WORKER_PROTECTION", "UNION_RIGHTS", "SOCIAL_SAFETY_NET"],
    taxImpact: {
      optimalCorporateRate: 20,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.82,
    },
    sectorImpact: {
      services: 1.3,
      technology: 1.4,
      professional: 1.2,
      manufacturing: 1.1,
      government: 0.7,
    },
    employmentImpact: {
      unemploymentModifier: -1.0,
      participationModifier: 1.2,
      wageGrowthModifier: 1.1,
    },
    implementationCost: 40000,
    maintenanceCost: 20000,
    requiredCapacity: 50,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: Unlock,
    color: "green",
    metadata: {
      complexity: "Low",
      timeToImplement: "1-2 years",
      staffRequired: 120,
      technologyRequired: false,
    },
  },

  [EconomicComponentType.PROTECTED_WORKERS]: {
    id: "protected_workers",
    type: EconomicComponentType.PROTECTED_WORKERS,
    name: formatComponentName(EconomicComponentType.PROTECTED_WORKERS),
    description: "Strong labor protections and worker rights",
    effectiveness: 75,
    synergies: [
      EconomicComponentType.UNION_BASED,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.EDUCATION_FIRST,
    ],
    conflicts: [
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.GIG_ECONOMY,
      EconomicComponentType.FREE_MARKET_SYSTEM,
    ],
    governmentSynergies: ["WORKER_PROTECTION", "SOCIAL_SAFETY_NET", "UNION_RIGHTS"],
    governmentConflicts: ["FREE_MARKET_SYSTEM", "MINIMAL_REGULATION"],
    taxImpact: {
      optimalCorporateRate: 26,
      optimalIncomeRate: 32,
      revenueEfficiency: 0.75,
    },
    sectorImpact: {
      manufacturing: 1.2,
      government: 1.3,
      education: 1.4,
      healthcare: 1.3,
      services: 0.9,
      technology: 0.8,
    },
    employmentImpact: {
      unemploymentModifier: 0.5,
      participationModifier: 0.9,
      wageGrowthModifier: 1.2,
    },
    implementationCost: 80000,
    maintenanceCost: 45000,
    requiredCapacity: 70,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: Shield,
    color: "indigo",
    metadata: {
      complexity: "High",
      timeToImplement: "4-5 years",
      staffRequired: 300,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.GIG_ECONOMY]: {
    id: "gig_economy",
    type: EconomicComponentType.GIG_ECONOMY,
    name: formatComponentName(EconomicComponentType.GIG_ECONOMY),
    description: "Economy based on short-term contracts and freelance work",
    effectiveness: 78,
    synergies: [
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.STARTUP_ECOSYSTEM,
    ],
    conflicts: [
      EconomicComponentType.UNION_BASED,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
    ],
    governmentSynergies: ["ENTREPRENEURSHIP_SUPPORT", "DIGITAL_GOVERNMENT", "FLEXIBLE_REGULATION"],
    governmentConflicts: ["WORKER_PROTECTION", "UNION_RIGHTS", "SOCIAL_SAFETY_NET"],
    taxImpact: {
      optimalCorporateRate: 22,
      optimalIncomeRate: 28,
      revenueEfficiency: 0.78,
    },
    sectorImpact: {
      services: 1.5,
      technology: 1.6,
      professional: 1.3,
      transportation: 1.4,
      manufacturing: 0.8,
      government: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: -0.8,
      participationModifier: 1.3,
      wageGrowthModifier: 0.9,
    },
    implementationCost: 60000,
    maintenanceCost: 30000,
    requiredCapacity: 60,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: Briefcase,
    color: "teal",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.EDUCATION_FIRST]: {
    id: "education_first",
    type: EconomicComponentType.EDUCATION_FIRST,
    name: formatComponentName(EconomicComponentType.EDUCATION_FIRST),
    description: "Priority on education and human capital development",
    effectiveness: 88,
    synergies: [
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
    ],
    conflicts: [
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
    ],
    governmentSynergies: [
      "PUBLIC_EDUCATION",
      "RESEARCH_AND_DEVELOPMENT",
      "UNIVERSITY_PARTNERSHIPS",
    ],
    governmentConflicts: ["RESOURCE_EXTRACTION", "TRADITIONAL_ECONOMY"],
    taxImpact: {
      optimalCorporateRate: 24,
      optimalIncomeRate: 30,
      revenueEfficiency: 0.88,
    },
    sectorImpact: {
      education: 2.2,
      professional: 1.8,
      technology: 1.7,
      healthcare: 1.5,
      manufacturing: 1.0,
      agriculture: 0.6,
    },
    employmentImpact: {
      unemploymentModifier: -1.8,
      participationModifier: 1.4,
      wageGrowthModifier: 1.6,
    },
    implementationCost: 200000,
    maintenanceCost: 100000,
    requiredCapacity: 90,
    category: EconomicCategory.LABOR_SYSTEM,
    icon: GraduationCap,
    color: "purple",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 180,
      technologyRequired: true,
    },
  },

  // Trade Policy Components
  [EconomicComponentType.FREE_TRADE]: {
    id: "free_trade",
    type: EconomicComponentType.FREE_TRADE,
    name: formatComponentName(EconomicComponentType.FREE_TRADE),
    description: "Minimal trade barriers and open international markets",
    effectiveness: 85,
    synergies: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.FINANCE_CENTERED,
    ],
    conflicts: [
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.IMPORT_SUBSTITUTION,
      EconomicComponentType.TRADE_BLOC,
    ],
    governmentSynergies: ["FREE_TRADE", "INTERNATIONAL_LAW", "MULTILATERAL_DIPLOMACY"],
    governmentConflicts: ["PROTECTIONIST_POLICY", "ECONOMIC_NATIONALISM"],
    taxImpact: {
      optimalCorporateRate: 18,
      optimalIncomeRate: 26,
      revenueEfficiency: 0.85,
    },
    sectorImpact: {
      manufacturing: 1.4,
      services: 1.2,
      finance: 1.3,
      agriculture: 1.1,
      technology: 1.3,
    },
    employmentImpact: {
      unemploymentModifier: -1.2,
      participationModifier: 1.2,
      wageGrowthModifier: 1.3,
    },
    implementationCost: 70000,
    maintenanceCost: 35000,
    requiredCapacity: 70,
    category: EconomicCategory.TRADE_POLICY,
    icon: Globe,
    color: "indigo",
    metadata: {
      complexity: "High",
      timeToImplement: "4-5 years",
      staffRequired: 300,
      technologyRequired: true,
    },
  },

  [EconomicComponentType.PROTECTIONIST]: {
    id: "protectionist",
    type: EconomicComponentType.PROTECTIONIST,
    name: formatComponentName(EconomicComponentType.PROTECTIONIST),
    description: "Trade barriers to protect domestic industries",
    effectiveness: 65,
    synergies: [
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.IMPORT_SUBSTITUTION,
      EconomicComponentType.MANUFACTURING_LED,
    ],
    conflicts: [
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.FINANCE_CENTERED,
    ],
    governmentSynergies: [
      "PROTECTIONIST_POLICY",
      "ECONOMIC_NATIONALISM",
      "DOMESTIC_INDUSTRY_SUPPORT",
    ],
    governmentConflicts: ["FREE_TRADE", "INTERNATIONAL_COOPERATION"],
    taxImpact: {
      optimalCorporateRate: 28,
      optimalIncomeRate: 32,
      revenueEfficiency: 0.65,
    },
    sectorImpact: {
      manufacturing: 1.3,
      agriculture: 1.2,
      services: 0.9,
      finance: 0.7,
      technology: 0.8,
    },
    employmentImpact: {
      unemploymentModifier: 1.5,
      participationModifier: 0.9,
      wageGrowthModifier: 0.8,
    },
    implementationCost: 90000,
    maintenanceCost: 50000,
    requiredCapacity: 75,
    category: EconomicCategory.TRADE_POLICY,
    icon: Lock,
    color: "emerald",
    metadata: {
      complexity: "Medium",
      timeToImplement: "2-3 years",
      staffRequired: 160,
      technologyRequired: true,
    },
  },

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
    ],
    conflicts: [
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.TOURISM_BASED,
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

  // Innovation Components
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

// ============================================================================
// Category Definitions
// ============================================================================

/**
 * Economic Component Categories
 * Organizes components into logical groups
 */
export const COMPONENT_CATEGORIES: Record<string, EconomicCategoryDefinition> = {
  "Economic Model": {
    name: "Economic Model",
    description: "Fundamental economic system and philosophy",
    icon: BarChart3,
    components: [
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.MIXED_ECONOMY,
      EconomicComponentType.STATE_CAPITALISM,
      EconomicComponentType.PLANNED_ECONOMY,
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
    ],
  },
  "Sector Focus": {
    name: "Sector Focus",
    description: "Primary economic sectors and specializations",
    icon: Factory,
    components: [
      EconomicComponentType.AGRICULTURE_LED,
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.TOURISM_BASED,
    ],
  },
  "Labor System": {
    name: "Labor System",
    description: "Labor market structure and worker rights",
    icon: Users,
    components: [
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.UNION_BASED,
      EconomicComponentType.GIG_ECONOMY,
      EconomicComponentType.PROFESSIONAL_SERVICES,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.EDUCATION_FIRST,
      EconomicComponentType.MERIT_BASED,
    ],
  },
  "Trade Policy": {
    name: "Trade Policy",
    description: "International trade and commerce approach",
    icon: Globe,
    components: [
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.EXPORT_SUBSIDY,
      EconomicComponentType.IMPORT_SUBSTITUTION,
      EconomicComponentType.TRADE_BLOC,
      EconomicComponentType.BILATERAL_FOCUS,
      EconomicComponentType.MULTILATERAL_FOCUS,
    ],
  },
  Innovation: {
    name: "Innovation",
    description: "Research, development, and innovation ecosystem",
    icon: Lightbulb,
    components: [
      EconomicComponentType.RD_INVESTMENT,
      EconomicComponentType.TECH_TRANSFER,
      EconomicComponentType.STARTUP_ECOSYSTEM,
      EconomicComponentType.PATENT_PROTECTION,
      EconomicComponentType.OPEN_INNOVATION,
      EconomicComponentType.UNIVERSITY_PARTNERSHIPS,
      EconomicComponentType.VENTURE_CAPITAL,
      EconomicComponentType.INTELLECTUAL_PROPERTY,
    ],
  },
  "Resource Management": {
    name: "Resource Management",
    description: "Natural resource use and environmental approach",
    icon: Leaf,
    components: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.CONSERVATION_FIRST,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.CARBON_NEUTRAL,
      EconomicComponentType.ECO_FRIENDLY,
    ],
  },
};

// ============================================================================
// Template Presets
// ============================================================================

/**
 * Economic Configuration Template
 */
export interface EconomicTemplate {
  id: string;
  name: string;
  description: string;
  components: EconomicComponentType[];
  icon: LucideIcon;
}

/**
 * Template Presets for Common Economic Configurations
 */
export const ECONOMIC_TEMPLATES: EconomicTemplate[] = [
  {
    id: "tech_innovation",
    name: "Tech Innovation Hub",
    description: "Knowledge economy focused on technology and innovation",
    icon: Lightbulb,
    components: [
      EconomicComponentType.INNOVATION_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
      EconomicComponentType.STARTUP_ECOSYSTEM,
      EconomicComponentType.RD_INVESTMENT,
      EconomicComponentType.FLEXIBLE_LABOR,
      EconomicComponentType.FREE_TRADE,
    ],
  },
  {
    id: "manufacturing_powerhouse",
    name: "Manufacturing Powerhouse",
    description: "Export-oriented manufacturing economy",
    icon: Factory,
    components: [
      EconomicComponentType.MANUFACTURING_LED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.SKILL_BASED,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
    ],
  },
  {
    id: "social_market",
    name: "Social Market Economy",
    description: "Balanced approach with strong worker protections",
    icon: Heart,
    components: [
      EconomicComponentType.SOCIAL_MARKET_ECONOMY,
      EconomicComponentType.PROTECTED_WORKERS,
      EconomicComponentType.EDUCATION_FIRST,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
    ],
  },
  {
    id: "green_economy",
    name: "Green Economy",
    description: "Sustainable development with renewable energy focus",
    icon: Leaf,
    components: [
      EconomicComponentType.SUSTAINABLE_DEVELOPMENT,
      EconomicComponentType.RENEWABLE_ENERGY,
      EconomicComponentType.CIRCULAR_ECONOMY,
      EconomicComponentType.KNOWLEDGE_ECONOMY,
      EconomicComponentType.TECHNOLOGY_FOCUSED,
    ],
  },
  {
    id: "financial_center",
    name: "Financial Center",
    description: "Services and finance-focused economy",
    icon: DollarSign,
    components: [
      EconomicComponentType.FINANCE_CENTERED,
      EconomicComponentType.SERVICE_BASED,
      EconomicComponentType.FREE_MARKET_SYSTEM,
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.FLEXIBLE_LABOR,
    ],
  },
  {
    id: "resource_economy",
    name: "Resource Economy",
    description: "Natural resource extraction and export",
    icon: Wrench,
    components: [
      EconomicComponentType.RESOURCE_BASED_ECONOMY,
      EconomicComponentType.EXTRACTION_FOCUSED,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.MANUFACTURING_LED,
    ],
  },
];
