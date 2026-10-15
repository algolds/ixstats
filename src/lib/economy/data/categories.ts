/**
 * Atomic Economic Components - Categories
 *
 * Logical category groups for organizing economic components.
 *
 * @module atomic-economic-data/categories
 */

import {
  StatsReport as BarChart3,
  Industry as Factory,
  Group as Users,
  Globe,
  LightBulb as Lightbulb,
  Leaf,
} from "iconoir-react";
import { EconomicComponentType, type EconomicCategoryDefinition } from "./types";

/**
 * Economic Component Categories
 * Organizes components into logical groups. Each defined component appears in exactly one
 * group, the one matching its own `category` field.
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
      EconomicComponentType.RULE_OF_LAW,
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
      EconomicComponentType.DOMESTIC_FOCUSED,
      EconomicComponentType.TOURISM_BASED,
      EconomicComponentType.REAL_ESTATE_FOCUSED,
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
      EconomicComponentType.HIGH_SKILLED_WORKERS,
      EconomicComponentType.EDUCATION_FOCUSED,
      EconomicComponentType.HEALTHCARE_FOCUSED,
      EconomicComponentType.VOCATIONAL_TRAINING,
    ],
  },
  "Trade Policy": {
    name: "Trade Policy",
    description: "International trade and commerce approach",
    icon: Globe,
    components: [
      EconomicComponentType.FREE_TRADE,
      EconomicComponentType.PROTECTIONIST,
      EconomicComponentType.EXPORT_ORIENTED,
      EconomicComponentType.BALANCED_TRADE,
      EconomicComponentType.EXPORT_SUBSIDY,
      EconomicComponentType.IMPORT_SUBSTITUTION,
      EconomicComponentType.TRADE_BLOC,
      EconomicComponentType.BILATERAL_FOCUS,
      EconomicComponentType.MULTILATERAL_FOCUS,
      EconomicComponentType.TRADE_FACILITATION,
      EconomicComponentType.COMPETITIVE_MARKETS,
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
      EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
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
      EconomicComponentType.LINEAR_ECONOMY,
      EconomicComponentType.CONSERVATION_FIRST,
      EconomicComponentType.GREEN_TECHNOLOGY,
      EconomicComponentType.CARBON_NEUTRAL,
      EconomicComponentType.CARBON_INTENSIVE,
      EconomicComponentType.ECO_FRIENDLY,
      EconomicComponentType.GREEN_ECONOMY,
    ],
  },
};
