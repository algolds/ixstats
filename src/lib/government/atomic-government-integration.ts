/**
 * Atomic Government Integration System
 *
 * Provides live-wired integration between atomic government components
 * and the government builder system.
 */

import { ComponentType } from "~/lib/enums";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import type { GovernmentBuilderState, GovernmentType } from "~/types/government";
import type { EconomicInputs } from "~/types/builder/economic-inputs";
import {
  ATOMIC_TO_GOVERNMENT_MAPPING,
  type AtomicGovernmentMapping,
} from "./government-mappings";

export { ATOMIC_TO_GOVERNMENT_MAPPING, type AtomicGovernmentMapping };

export interface AtomicIntegrationFeedback {
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  actionable: boolean;
  actionLabel?: string;
  actionUrl?: string;
  suggestedComponents?: ComponentType[];
  impact: "low" | "medium" | "high" | "critical";
}

/**
 * Generate government builder state from atomic components
 */
export function generateGovernmentBuilderFromAtomicComponents(
  selectedComponents: ComponentType[],
  baseBudget: number,
  economicInputs: EconomicInputs
): GovernmentBuilderState {
  const departments: Array<{
    name: string;
    category: string;
    functions: string[];
    priority: number;
    effectiveness: number;
    description: string;
    icon: string;
    color: string;
    ministerTitle: string;
    organizationalLevel: string;
  }> = [];
  const budgetAllocations: Array<{
    departmentId: string;
    allocatedAmount: number;
    allocatedPercent: number;
    rationale: string;
    budgetYear: number;
  }> = [];
  // oxlint-disable-next-line eslint/no-unused-vars
  const revenueSources: Array<{
    name: string;
    category: string;
    revenueAmount: number;
    rate?: number;
    collectionMethod: string;
    administeredBy: string;
  }> = [];

  let departmentIndex = 0;

  // Generate departments and budget allocations for each component
  selectedComponents.forEach((component) => {
    const mapping = ATOMIC_TO_GOVERNMENT_MAPPING[component];
    if (mapping) {
      mapping.departments.forEach((dept: AtomicGovernmentMapping["departments"][number]) => {
        const departmentId = departmentIndex.toString();

        departments.push({
          name: dept.name,
          category: dept.category,
          functions: dept.functions,
          priority: dept.priority,
          effectiveness: dept.effectiveness,
          description: dept.description,
          icon: getDepartmentIcon(dept.category),
          color: getDepartmentColor(dept.category),
          ministerTitle: `Minister of ${dept.category}`,
          organizationalLevel: "Ministry",
        });

        // Find corresponding budget allocation
        const allocation = mapping.budgetAllocations.find(
          (a: AtomicGovernmentMapping["budgetAllocations"][number]) => a.departmentId === departmentIndex.toString()
        );
        if (allocation) {
          const allocatedAmount = (baseBudget * allocation.allocatedPercent) / 100;
          budgetAllocations.push({
            departmentId: departmentId,
            allocatedAmount: allocatedAmount,
            allocatedPercent: allocation.allocatedPercent,
            rationale: allocation.rationale,
            budgetYear: new Date().getFullYear(),
          });
        }

        departmentIndex++;
      });
    }
  });

  // Calculate annual maintenance costs from atomic components
  const annualMaintenanceCost = selectedComponents.reduce((sum, comp) => {
    const component = ATOMIC_COMPONENTS[comp];
    return sum + (component?.maintenanceCost || 0);
  }, 0);

  // Adjust base budget to include annual maintenance costs
  const adjustedBudget = baseBudget + annualMaintenanceCost;

  // Generate revenue sources based on components
  const revenueSourcesList = generateRevenueSourcesFromComponents(
    selectedComponents,
    adjustedBudget
  );

  return {
    structure: {
      governmentName: `Government of ${economicInputs.countryName || "Nation"}`,
      governmentType: determineGovernmentType(selectedComponents),
      totalBudget: adjustedBudget,
      fiscalYear: "Calendar Year",
      budgetCurrency: economicInputs.nationalIdentity?.currency || "USD",
    },
    departments: departments,
    budgetAllocations: budgetAllocations,
    revenueSources: revenueSourcesList,
    isValid: true,
    errors: { structure: [], departments: {}, budget: [], revenue: [] },
    atomicComponentCosts: {
      annualMaintenanceCost,
      implementationCost: selectedComponents.reduce(
        (sum, comp) => sum + (ATOMIC_COMPONENTS[comp]?.implementationCost || 0),
        0
      ),
    },
  } as GovernmentBuilderState & {
    atomicComponentCosts: { annualMaintenanceCost: number; implementationCost: number };
  };
}

/**
 * Generate intelligent feedback based on atomic component selections
 */
export function generateAtomicIntegrationFeedback(
  selectedComponents: ComponentType[],
  currentGovernmentBuilder: GovernmentBuilderState | null,
  economicInputs: EconomicInputs
): AtomicIntegrationFeedback[] {
  const feedback: AtomicIntegrationFeedback[] = [];

  // Check for synergies
  const synergies = detectSynergies(selectedComponents);
  synergies.forEach((synergy) => {
    feedback.push({
      type: "success",
      title: "Synergy Detected",
      message: `Components ${synergy.components.join(" + ")} create a powerful synergy effect (+${synergy.modifier}% effectiveness)`,
      actionable: false,
      impact: "high",
    });
  });

  // Check for conflicts
  const conflicts = detectConflicts(selectedComponents);
  if (conflicts.length > 0) {
    // Group conflicts by type to reduce UI clutter
    const conflictGroups = new Map<string, { components: string[]; penalties: number[] }>();

    conflicts.forEach((conflict) => {
      const key = conflict.components.sort().join("+");
      if (!conflictGroups.has(key)) {
        conflictGroups.set(key, { components: conflict.components, penalties: [] });
      }
      conflictGroups.get(key)!.penalties.push(conflict.penalty);
    });

    // oxlint-disable-next-line eslint/no-unused-vars
    conflictGroups.forEach((group, key) => {
      const avgPenalty = Math.round(
        group.penalties.reduce((a, b) => a + b, 0) / group.penalties.length
      );
      feedback.push({
        type: "warning",
        title: "Component Conflict Detected",
        message: `Components ${group.components.join(" and ")} are mutually exclusive (${avgPenalty}% effectiveness penalty)`,
        actionable: true,
        actionLabel: "Review Components",
        impact: "medium",
      });
    });
  }

  // Check if government builder needs updating
  if (
    currentGovernmentBuilder &&
    !isGovernmentBuilderInSync(selectedComponents, currentGovernmentBuilder)
  ) {
    feedback.push({
      type: "info",
      title: "Government Builder Update Available",
      message:
        "Your atomic components have changed. Update your government builder to reflect these changes.",
      actionable: true,
      actionLabel: "Update Government Builder",
      actionUrl: "/builder?section=government",
      impact: "high",
    });
  }

  // Check for missing essential components
  const essentialComponents = getEssentialComponents(economicInputs);
  const missingEssential = essentialComponents.filter((comp) => !selectedComponents.includes(comp));
  if (missingEssential.length > 0) {
    feedback.push({
      type: "error",
      title: "Essential Components Missing",
      message: `Consider adding: ${missingEssential.join(", ")} for better governance`,
      actionable: true,
      actionLabel: "Add Components",
      suggestedComponents: missingEssential,
      impact: "critical",
    });
  }

  return feedback;
}

/**
 * Detect synergies between atomic components
 */
function detectSynergies(
  components: ComponentType[]
): Array<{ components: string[]; modifier: number }> {
  const synergies: Array<{ components: string[]; modifier: number }> = [];

  // Define synergy patterns
  const synergyPatterns = [
    {
      components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.RULE_OF_LAW],
      modifier: 15,
      description: "Democratic rule of law",
    },
    {
      components: [ComponentType.FEDERAL_SYSTEM, ComponentType.PROFESSIONAL_BUREAUCRACY],
      modifier: 12,
      description: "Professional federal administration",
    },
    {
      components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PERFORMANCE_LEGITIMACY],
      modifier: 18,
      description: "Evidence-based performance governance",
    },
  ];

  synergyPatterns.forEach((pattern) => {
    if (pattern.components.every((comp) => components.includes(comp))) {
      synergies.push({
        components: pattern.components,
        modifier: pattern.modifier,
      });
    }
  });

  return synergies;
}

/**
 * Detect conflicts between atomic components
 */
function detectConflicts(
  components: ComponentType[]
): Array<{ components: string[]; penalty: number }> {
  const conflicts: Array<{ components: string[]; penalty: number }> = [];

  // Define conflict patterns
  const conflictPatterns = [
    {
      components: [ComponentType.CENTRALIZED_POWER, ComponentType.FEDERAL_SYSTEM],
      penalty: 20,
      description: "Centralized vs federal power",
    },
    {
      components: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.DEMOCRATIC_PROCESS],
      penalty: 25,
      description: "Autocratic vs democratic processes",
    },
  ];

  conflictPatterns.forEach((pattern) => {
    if (pattern.components.every((comp) => components.includes(comp))) {
      conflicts.push({
        components: pattern.components,
        penalty: pattern.penalty,
      });
    }
  });

  return conflicts;
}

/**
 * Check if government builder is in sync with atomic components
 */
function isGovernmentBuilderInSync(
  components: ComponentType[],
  governmentBuilder: GovernmentBuilderState
): boolean {
  // Check if departments match expected departments from components
  const expectedDepartments = components.flatMap(
    (comp) => ATOMIC_TO_GOVERNMENT_MAPPING[comp]?.departments.map((d: AtomicGovernmentMapping["departments"][number]) => d.name) || []
  );

  const actualDepartments = governmentBuilder.departments.map((d) => d.name);

  return expectedDepartments.every((dept) => actualDepartments.includes(dept));
}

/**
 * Get essential components based on economic inputs
 */
function getEssentialComponents(economicInputs: EconomicInputs): ComponentType[] {
  const essential: ComponentType[] = [ComponentType.RULE_OF_LAW];

  // Add components based on economic characteristics
  if (economicInputs.coreIndicators.nominalGDP > 1000000000000) {
    essential.push(ComponentType.PROFESSIONAL_BUREAUCRACY);
  }

  if (economicInputs.governmentSpending.totalSpending > 100000000000) {
    essential.push(ComponentType.PERFORMANCE_LEGITIMACY);
  }

  return essential;
}

/**
 * Determine government type from atomic components
 */
function determineGovernmentType(components: ComponentType[]): GovernmentType {
  if (components.includes(ComponentType.DEMOCRATIC_PROCESS)) {
    if (components.includes(ComponentType.FEDERAL_SYSTEM)) {
      return "Federal Republic";
    }
    return "Parliamentary Democracy";
  }

  if (components.includes(ComponentType.AUTOCRATIC_PROCESS)) {
    return "Unitary State";
  }

  if (components.includes(ComponentType.TECHNOCRATIC_PROCESS)) {
    return "Unitary State";
  }

  return "Constitutional Monarchy";
}

/**
 * Generate revenue sources based on components
 */
function generateRevenueSourcesFromComponents(
  components: ComponentType[],
  baseBudget: number
): any[] {
  const revenueSources: any[] = [];

  // Base tax revenue
  revenueSources.push({
    name: "General Tax Revenue",
    category: "Direct Tax",
    revenueAmount: baseBudget * 0.6,
    rate: 20,
    collectionMethod: "Annual Assessment",
    administeredBy: "Tax Administration",
  });

  // Component-specific revenue sources
  if (components.includes(ComponentType.ECONOMIC_INCENTIVES)) {
    revenueSources.push({
      name: "Market-Based Fees",
      category: "Fees and Fines",
      revenueAmount: baseBudget * 0.15,
      collectionMethod: "Service Fees",
      administeredBy: "Economic Affairs Office",
    });
  }

  return revenueSources;
}

/**
 * Get department icon based on category
 */
function getDepartmentIcon(category: string): string {
  const iconMap: Record<string, string> = {
    Administration: "Building2",
    Justice: "Scale",
    Defense: "Shield",
    Economics: "TrendingUp",
    "Social Services": "Users",
    Culture: "Palette",
    Infrastructure: "Building",
    Security: "Shield",
  };

  return iconMap[category] || "Building2";
}

/**
 * Get department color based on category
 */
function getDepartmentColor(category: string): string {
  const colorMap: Record<string, string> = {
    Administration: "#3b82f6",
    Justice: "#8b5cf6",
    Defense: "#ef4444",
    Economics: "#10b981",
    "Social Services": "#f59e0b",
    Culture: "#ec4899",
    Infrastructure: "#6b7280",
    Security: "#dc2626",
  };

  return colorMap[category] || "#3b82f6";
}
