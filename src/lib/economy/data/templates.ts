/**
 * Atomic Economic Components - Templates
 *
 * Template presets for common economic configurations.
 *
 * @module atomic-economic-data/templates
 */

import {
  LightBulb as Lightbulb,
  Industry as Factory,
  Heart,
  Leaf,
  Dollar as DollarSign,
  Wrench,
} from "iconoir-react";
import { EconomicComponentType, type EconomicTemplate } from "./types";

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
