// src/lib/services/defenseGovernmentBridge.ts
// Bidirectional sync between Defense System and Government Builder

import type {
  GovernmentStructure,
  GovernmentDepartment,
  BudgetAllocation,
} from "~/types/government";

interface DefenseBudgetData {
  totalBudget: number;
  gdpPercent: number;
  personnelCosts: number;
  operationsMaintenance: number;
  procurement: number;
  rdteCosts: number;
  militaryConstruction: number;
}

interface MilitaryBranch {
  id: string;
  branchType: string;
  name: string;
  annualBudget: number;
  budgetPercent: number;
  activeDuty: number;
  reserves: number;
  civilianStaff: number;
}

/**
 * Detects defense-related departments in government structure
 */
export function findDefenseDepartments(
  governmentStructure: GovernmentStructure | null
): GovernmentDepartment[] {
  if (!governmentStructure?.departments) return [];

  return governmentStructure.departments.filter(
    (dept) =>
      dept.category === "Defense" ||
      dept.category === "Veterans Affairs" ||
      dept.category === "Intelligence" ||
      dept.name.toLowerCase().includes("defense") ||
      dept.name.toLowerCase().includes("military") ||
      dept.name.toLowerCase().includes("armed forces") ||
      dept.name.toLowerCase().includes("national security")
  );
}

/**
 * Extract defense budget from government structure
 */
export function extractDefenseBudget(
  governmentStructure: GovernmentStructure | null,
  countryGDP: number
): DefenseBudgetData | null {
  if (!governmentStructure) return null;

  const defenseDepts = findDefenseDepartments(governmentStructure);
  if (defenseDepts.length === 0) return null;

  // Get budget allocations for defense departments
  const defenseBudgetAllocations =
    governmentStructure.budgetAllocations?.filter((allocation) =>
      defenseDepts.some((dept) => dept.id === allocation.departmentId)
    ) || [];

  const totalBudget = defenseBudgetAllocations.reduce(
    (sum, allocation) => sum + allocation.allocatedAmount,
    0
  );

  if (totalBudget === 0) return null;

  const gdpPercent = countryGDP > 0 ? (totalBudget / countryGDP) * 100 : 0;

  // Estimate breakdown based on typical military spending patterns
  const personnelCosts = totalBudget * 0.4;
  const operationsMaintenance = totalBudget * 0.3;
  const procurement = totalBudget * 0.15;
  const rdteCosts = totalBudget * 0.1;
  const militaryConstruction = totalBudget * 0.05;

  return {
    totalBudget,
    gdpPercent,
    personnelCosts,
    operationsMaintenance,
    procurement,
    rdteCosts,
    militaryConstruction,
  };
}

/**
 * Sync defense budget changes back to government structure
 */
export function syncDefenseBudgetToGovernment(
  defenseBudget: DefenseBudgetData,
  governmentStructure: GovernmentStructure,
  militaryBranches: MilitaryBranch[]
): Partial<GovernmentStructure> {
  const defenseDepts = findDefenseDepartments(governmentStructure);

  if (defenseDepts.length === 0) {
    console.warn("[DefenseSync] No defense departments found to sync budget");
    return {};
  }

  // Update budget allocations for defense departments
  const updatedAllocations: BudgetAllocation[] =
    governmentStructure.budgetAllocations?.map((allocation) => {
      const isDepartmentDefense = defenseDepts.some((dept) => dept.id === allocation.departmentId);

      if (!isDepartmentDefense) return allocation;

      // Split total defense budget proportionally among defense departments
      const share = defenseDepts.length > 0 ? defenseBudget.totalBudget / defenseDepts.length : 0;

      return {
        ...allocation,
        allocatedAmount: share,
        allocatedPercent:
          governmentStructure.totalBudget > 0 ? (share / governmentStructure.totalBudget) * 100 : 0,
        availableAmount: share - (allocation.spentAmount || 0),
        lastReviewed: new Date(),
        notes: `Auto-synced from Defense System - ${new Date().toISOString()}`,
      };
    }) || [];

  return {
    budgetAllocations: updatedAllocations,
    updatedAt: new Date(),
  };
}

/**
 * Calculate defense budget from military branches
 */
export function calculateDefenseBudgetFromBranches(
  militaryBranches: MilitaryBranch[],
  countryGDP: number
): DefenseBudgetData {
  const totalBudget = militaryBranches.reduce((sum, branch) => sum + branch.annualBudget, 0);

  const gdpPercent = countryGDP > 0 ? (totalBudget / countryGDP) * 100 : 0;

  // Estimate breakdown based on typical military spending patterns
  const personnelCosts = totalBudget * 0.4;
  const operationsMaintenance = totalBudget * 0.3;
  const procurement = totalBudget * 0.15;
  const rdteCosts = totalBudget * 0.1;
  const militaryConstruction = totalBudget * 0.05;

  return {
    totalBudget,
    gdpPercent,
    personnelCosts,
    operationsMaintenance,
    procurement,
    rdteCosts,
    militaryConstruction,
  };
}

/**
 * Smart budget sync - determines which system to use as source of truth
 */
export function getAuthoritativeBudget(
  defenseBudget: DefenseBudgetData | null,
  governmentBudget: DefenseBudgetData | null,
  militaryBranches: MilitaryBranch[],
  countryGDP: number
): {
  budget: DefenseBudgetData;
  source: "defense_system" | "government_structure" | "calculated";
  needsSync: boolean;
  syncTarget?: "defense" | "government";
} {
  // If we have military branches with budgets, they take precedence
  const calculatedBudget = calculateDefenseBudgetFromBranches(militaryBranches, countryGDP);

  if (calculatedBudget.totalBudget > 0) {
    // Check if government needs update
    const needsGovUpdate = governmentBudget
      ? Math.abs(governmentBudget.totalBudget - calculatedBudget.totalBudget) > 1000
      : true;

    return {
      budget: calculatedBudget,
      source: "defense_system",
      needsSync: needsGovUpdate,
      syncTarget: needsGovUpdate ? "government" : undefined,
    };
  }

  // If government has defense budget but no military branches, use government
  if (governmentBudget && governmentBudget.totalBudget > 0) {
    return {
      budget: governmentBudget,
      source: "government_structure",
      needsSync: false,
    };
  }

  // Fallback to zero budget
  return {
    budget: {
      totalBudget: 0,
      gdpPercent: 0,
      personnelCosts: 0,
      operationsMaintenance: 0,
      procurement: 0,
      rdteCosts: 0,
      militaryConstruction: 0,
    },
    source: "calculated",
    needsSync: false,
  };
}

/**
 * Get defense department info for display
 */
export function getDefenseDepartmentInfo(governmentStructure: GovernmentStructure | null): {
  hasDefenseDepartment: boolean;
  departmentCount: number;
  totalBudget: number;
  departments: GovernmentDepartment[];
} {
  const departments = findDefenseDepartments(governmentStructure);
  const totalBudget =
    governmentStructure?.budgetAllocations
      ?.filter((allocation) => departments.some((dept) => dept.id === allocation.departmentId))
      .reduce((sum, allocation) => sum + allocation.allocatedAmount, 0) || 0;

  return {
    hasDefenseDepartment: departments.length > 0,
    departmentCount: departments.length,
    totalBudget,
    departments,
  };
}
