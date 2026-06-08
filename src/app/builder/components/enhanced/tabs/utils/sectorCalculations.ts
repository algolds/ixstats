/**
 * Sector Calculation Utilities
 *
 * Provides sector templates, categorization logic, and aggregate calculations
 * for economic sector data. Extracted from EconomySectorsTab for reusability
 * across the economy builder system.
 */

import type { SectorConfiguration } from "~/types/economy-builder";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import { Factory, Leaf, Users, Zap, DollarSign, Building2, Pickaxe, type LucideIcon } from "lucide-react";

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
  mining: {
    name: "Mining & Extraction",
    icon: Pickaxe,
    color: "amber",
    baseContribution: 5,
    description: "Extraction of minerals, metals, oil, gas, and quarrying",
    characteristics: ["Capital-intensive", "Resource-dependent", "High environmental impact"],
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
    baseContribution: 55,
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
  if (["agriculture", "mining"].includes(sectorType)) return "Primary";
  if (["manufacturing", "construction"].includes(sectorType)) return "Secondary";
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
/**
 * Constraint information for a sector based on selected atomic components
 */
export interface SectorConstraint {
  /** Whether this sector template is locked/unavailable */
  locked: boolean;
  /** Components that caused this sector to be locked */
  lockedBy: string[];
  /** Whether this sector is recommended by selected components */
  recommended: boolean;
  /** Components that recommended this sector */
  recommendedBy: string[];
  /** Minimum allowed value for GDP contribution */
  minGDP: number;
  /** Maximum allowed value for GDP contribution */
  maxGDP: number;
  /** Minimum allowed growth rate */
  minGrowthRate: number;
  /** Maximum allowed growth rate */
  maxGrowthRate: number;
  /** Multiplier to apply to base contribution */
  impact: number;
}

/**
 * Calculate sector constraints from selected atomic components
 *
 * Analyzes sectorImpact values across all selected components to determine
 * which sectors are locked, recommended, and the allowed value ranges.
 *
 * @param selectedComponents - Array of selected economic component types
 * @returns Record of sector constraints keyed by sector template ID
 */
export function getSectorConstraints(
  selectedComponents: EconomicComponentType[]
): Record<string, SectorConstraint> {
  const sectorIds = Object.keys(SECTOR_TEMPLATES);
  const constraints: Record<string, SectorConstraint> = {};

  sectorIds.forEach((sectorId) => {
    let impact = 1.0;
    const lockedBy: string[] = [];
    const recommendedBy: string[] = [];

    if (selectedComponents.length > 0) {
      selectedComponents.forEach((compType) => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        const sectorMultiplier = component?.sectorImpact?.[sectorId] || 1.0;
        impact *= sectorMultiplier;

        if (sectorMultiplier < 0.5) {
          lockedBy.push(component?.name || compType);
        } else if (sectorMultiplier >= 1.2) {
          recommendedBy.push(component?.name || compType);
        }
      });
    }

    const locked = lockedBy.length > 0;
    const recommended = recommendedBy.length > 0;

    // Scale slider ranges based on impact
    const baseMaxGDP = 95;
    const baseMinGDP = 0;
    const baseMaxGrowth = 15;
    const baseMinGrowth = -5;

    // Strongly penalized sectors have tighter ranges
    const gdpRangeFactor = locked ? 0.3 : impact < 0.8 ? 0.5 : 1.0;
    const growthRangeFactor = locked ? 0.2 : impact < 0.8 ? 0.6 : 1.0;

    constraints[sectorId] = {
      locked,
      lockedBy,
      recommended,
      recommendedBy,
      impact,
      minGDP: Math.max(0, baseMinGDP * gdpRangeFactor),
      maxGDP: Math.round(baseMaxGDP * gdpRangeFactor),
      minGrowthRate: Math.max(-5, Math.round(baseMinGrowth * growthRangeFactor)),
      maxGrowthRate: Math.round(
        baseMinGrowth + (baseMaxGrowth - baseMinGrowth) * growthRangeFactor
      ),
    };
  });

  return constraints;
}

/**
 * Tax optimization info derived from selected atomic components
 */
export interface TaxOptimization {
  optimalCorporateRate: number;
  optimalIncomeRate: number;
  revenueEfficiency: number;
  componentCount: number;
}

/**
 * Compute optimal tax rates from selected atomic components
 *
 * Averages the taxImpact values across all selected components to
 * determine the most compatible tax rate range for the current build.
 *
 * @param selectedComponents - Array of selected economic component types
 * @returns Tax optimization info with recommended rates and efficiency
 */
export function getTaxOptimization(
  selectedComponents: EconomicComponentType[]
): TaxOptimization | null {
  if (selectedComponents.length === 0) return null;

  let corporateSum = 0;
  let incomeSum = 0;
  let efficiencySum = 0;
  let count = 0;

  selectedComponents.forEach((compType) => {
    const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
    if (!component?.taxImpact) return;
    corporateSum += component.taxImpact.optimalCorporateRate;
    incomeSum += component.taxImpact.optimalIncomeRate;
    efficiencySum += component.taxImpact.revenueEfficiency;
    count++;
  });

  if (count === 0) return null;

  return {
    optimalCorporateRate: Math.round(corporateSum / count),
    optimalIncomeRate: Math.round(incomeSum / count),
    revenueEfficiency: Math.round((efficiencySum / count) * 100) / 100,
    componentCount: count,
  };
}

export function calculateSectorTotals(sectors: SectorConfiguration[]) {
  const avgGrowthRate =
    sectors.length > 0
      ? sectors.reduce((sum, s) => sum + (s.growthRate || 0), 0) / sectors.length
      : 0;
  const averageProductivity =
    sectors.length > 0
      ? sectors.reduce((sum, s) => sum + (s.productivity || 0), 0) / sectors.length
      : 0;

  return {
    totalGDP: sectors.reduce((sum, sector) => sum + sector.gdpContribution, 0),
    totalEmployment: sectors.reduce((sum, sector) => sum + sector.employmentShare, 0),
    averageProductivity,
    avgProductivity: averageProductivity,
    avgGrowthRate,
  };
}
