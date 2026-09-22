/**
 * Atomic Economic Components - Types & Interfaces
 *
 * Core enum and interface definitions for the economic component system.
 *
 * @module atomic-economic-data/types
 */

import React from "react";

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
  HIGH_TAX_BURDEN = "HIGH_TAX_BURDEN",
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
  demographicImpact: {
    populationGrowthModifier: number;
    lifeExpectancyModifier: number;
    literacyModifier: number;
    urbanizationModifier: number;
  };
  implementationCost: number;
  maintenanceCost: number;
  requiredCapacity: number;
  category: EconomicCategory;
  icon: React.ComponentType<{ className?: string }>;
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
  icon: React.ComponentType<{ className?: string }>;
  components: EconomicComponentType[];
}

/**
 * Template Preset for Common Economic Configurations
 */
export interface EconomicTemplate {
  id: string;
  name: string;
  description: string;
  components: EconomicComponentType[];
  icon: React.ComponentType<{ className?: string }>;
}
