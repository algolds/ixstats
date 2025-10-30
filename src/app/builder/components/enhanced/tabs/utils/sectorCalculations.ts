/**
 * Sector Calculation Utilities
 *
 * Provides sector templates, categorization logic, and aggregate calculations
 * for economic sector data. Extracted from EconomySectorsTab for reusability
 * across the economy builder system.
 */

import type { SectorConfiguration } from "~/types/economy-builder";
import { Factory, Leaf, Users, Zap, DollarSign, Building2, type LucideIcon } from "lucide-react";

/**
 * Template defining default properties for an economic sector
 */
export interface SectorTemplate {
  /** Display name of the sector */
  name: string;
  /** Lucide icon component for UI representation */
  icon: LucideIcon;
  /** Tailwind color identifier */
  color: string;
  /** Base GDP contribution percentage */
  baseContribution: number;
  /** Human-readable description */
  description: string;
  /** Key characteristics of this sector */
  characteristics: string[];
}

/**
 * Predefined sector templates with default values
 *
 * Provides reasonable starting points for common economic sectors,
 * including their typical GDP contributions and key characteristics.
 */
export const SECTOR_TEMPLATES: Record<string, SectorTemplate> = {
  agriculture: {
    name: "Agriculture",
    icon: Leaf,
    color: "green",
    baseContribution: 5,
    description: "Farming, forestry, fishing, and related activities",
    characteristics: ["Labor-intensive", "Weather-dependent", "Export potential"],
  },
  manufacturing: {
    name: "Manufacturing",
    icon: Factory,
    color: "blue",
    baseContribution: 20,
    description: "Production of goods and industrial processing",
    characteristics: ["Capital-intensive", "Export-oriented", "Technology-driven"],
  },
  services: {
    name: "Services",
    icon: Users,
    color: "purple",
    baseContribution: 60,
    description: "Professional, business, and consumer services",
    characteristics: ["Knowledge-based", "Domestic-focused", "High-value"],
  },
  technology: {
    name: "Technology",
    icon: Zap,
    color: "cyan",
    baseContribution: 8,
    description: "Information technology and digital services",
    characteristics: ["Innovation-driven", "High-growth", "Export potential"],
  },
  finance: {
    name: "Finance",
    icon: DollarSign,
    color: "yellow",
    baseContribution: 5,
    description: "Banking, insurance, and financial services",
    characteristics: ["Capital-intensive", "Regulated", "High-profit"],
  },
  government: {
    name: "Government",
    icon: Building2,
    color: "gray",
    baseContribution: 2,
    description: "Public administration and government services",
    characteristics: ["Public sector", "Stable", "Service-oriented"],
  },
};

/**
 * Categorize a sector into primary, secondary, or tertiary
 *
 * Uses economic sector classification to determine the category
 * based on sector type.
 *
 * @param sectorType - Sector identifier
 * @returns Economic sector category
 *
 * @example
 * ```ts
 * getSectorCategory('agriculture'); // 'Primary'
 * getSectorCategory('manufacturing'); // 'Secondary'
 * getSectorCategory('services'); // 'Tertiary'
 * ```
 */
export function getSectorCategory(sectorType: string): "Primary" | "Secondary" | "Tertiary" {
  if (["agriculture"].includes(sectorType)) return "Primary";
  if (["manufacturing"].includes(sectorType)) return "Secondary";
  return "Tertiary";
}

/**
 * Calculate aggregate totals across all sectors
 *
 * Computes total GDP contribution, employment share, and average
 * productivity across all provided sectors.
 *
 * @param sectors - Array of sector configurations
 * @returns Aggregate sector metrics
 *
 * @example
 * ```ts
 * const totals = calculateSectorTotals(sectors);
 * // { totalGDP: 100, totalEmployment: 100, averageProductivity: 85.5 }
 * ```
 */
export function calculateSectorTotals(sectors: SectorConfiguration[]) {
  return {
    totalGDP: sectors.reduce((sum, sector) => sum + sector.gdpContribution, 0),
    totalEmployment: sectors.reduce((sum, sector) => sum + sector.employmentShare, 0),
    averageProductivity:
      sectors.length > 0 ? sectors.reduce((sum, s) => sum + s.productivity, 0) / sectors.length : 0,
  };
}
