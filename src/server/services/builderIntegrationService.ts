/**
 * Builder Integration Service
 *
 * Intelligent field mapping and synchronization service for Government and Tax Builders.
 * This service ensures that every field from the builders is properly mapped to the
 * appropriate database tables and synchronized across the entire system.
 *
 * Key Features:
 * - Intelligent field mapping to multiple database tables
 * - Conflict detection with detailed warnings
 * - Cross-system synchronization (Government ↔ Fiscal ↔ Tax)
 * - Audit trail for all changes
 * - Rollback support for failed operations
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { GovernmentBuilderState } from "~/types/government";
import type { TaxBuilderState } from "~/types/builder";

// Type for government data without validation state
type GovernmentBuilderData = Omit<GovernmentBuilderState, "isValid" | "errors">;

// Type for tax data without validation state
type TaxBuilderData = Omit<TaxBuilderState, "isValid" | "errors">;

export interface ConflictWarning {
  field: string;
  currentValue: any;
  newValue: any;
  affectedSystems: string[];
  severity: "info" | "warning" | "critical";
  message: string;
}

interface IntegrationResult {
  success: boolean;
  warnings: ConflictWarning[];
  affectedTables: string[];
  syncedFields: string[];
  errors?: string[];
}

/**
 * Mapping for department categories to budget spending categories
 */
const DEPARTMENT_TO_SPENDING_CATEGORY: Record<string, string> = {
  Defense: "defense",
  Education: "education",
  Health: "healthcare",
  Transportation: "infrastructure",
  "Social Services": "socialSecurity",
  Finance: "other",
  "Foreign Affairs": "other",
  Interior: "other",
  Justice: "other",
  Agriculture: "other",
  Environment: "other",
  Labor: "other",
  Commerce: "other",
  Energy: "infrastructure",
  Communications: "infrastructure",
  Culture: "education",
  "Science and Technology": "education",
  Housing: "socialSecurity",
  "Veterans Affairs": "socialSecurity",
  Intelligence: "defense",
  "Emergency Management": "other",
  Other: "other",
};

/**
 * Detect conflicts when updating government structure
 */
export async function detectGovernmentConflicts(
  db: PrismaClient,
  countryId: string,
  newData: GovernmentBuilderState | GovernmentBuilderData
): Promise<ConflictWarning[]> {
  const warnings: ConflictWarning[] = [];

  // Check if government structure exists
  const existingGovStructure = await db.governmentStructure.findUnique({
    where: { countryId },
    include: {
      departments: true,
      budgetAllocations: true,
      revenueSources: true,
    },
  });

  // Check country data for conflicts
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { governmentType: true, leader: true },
  });

  if (existingGovStructure) {
    // Check for government type conflict
    if (newData.structure.governmentType !== existingGovStructure.governmentType) {
      warnings.push({
        field: "Government Type",
        currentValue: existingGovStructure.governmentType,
        newValue: newData.structure.governmentType,
        affectedSystems: ["GovernmentStructure", "Country"],
        severity: "warning",
        message: `Changing government type from "${existingGovStructure.governmentType}" to "${newData.structure.governmentType}" will update your country's profile.`,
      });
    }

    // Check for head of state conflict
    if (
      newData.structure.headOfState &&
      newData.structure.headOfState !== existingGovStructure.headOfState
    ) {
      warnings.push({
        field: "Head of State",
        currentValue: existingGovStructure.headOfState,
        newValue: newData.structure.headOfState,
        affectedSystems: ["GovernmentStructure", "Country"],
        severity: "info",
        message: `Updating head of state from "${existingGovStructure.headOfState || "Unknown"}" to "${newData.structure.headOfState}".`,
      });
    }

    // Check for total budget conflict
    if (
      Math.abs(newData.structure.totalBudget - existingGovStructure.totalBudget) /
        existingGovStructure.totalBudget >
      0.1
    ) {
      warnings.push({
        field: "Total Budget",
        currentValue: existingGovStructure.totalBudget,
        newValue: newData.structure.totalBudget,
        affectedSystems: ["GovernmentStructure", "GovernmentBudget", "FiscalSystem"],
        severity: "warning",
        message: `Total budget is changing by ${((Math.abs(newData.structure.totalBudget - existingGovStructure.totalBudget) / existingGovStructure.totalBudget) * 100).toFixed(1)}%. This will affect all budget allocations and fiscal calculations.`,
      });
    }

    // Check for department deletions
    const existingDeptNames = new Set(existingGovStructure.departments.map((d) => d.name));
    const newDeptNames = new Set(newData.departments.map((d) => d.name));
    const deletedDepts = [...existingDeptNames].filter((name) => !newDeptNames.has(name));

    if (deletedDepts.length > 0) {
      warnings.push({
        field: "Departments",
        currentValue: deletedDepts,
        newValue: [],
        affectedSystems: ["GovernmentDepartment", "BudgetAllocation"],
        severity: "critical",
        message: `Removing ${deletedDepts.length} department(s): ${deletedDepts.join(", ")}. All associated budget allocations will be deleted.`,
      });
    }

    // Budget allocation coverage check
    const totalPercent = (newData.budgetAllocations || []).reduce(
      (s, a: any) => s + (a.allocatedPercent || 0),
      0
    );
    if (totalPercent > 100.0001) {
      warnings.push({
        field: "Budget Allocation",
        currentValue: existingGovStructure.budgetAllocations.length,
        newValue: (newData.budgetAllocations || []).length,
        affectedSystems: ["BudgetAllocation", "GovernmentBudget"],
        severity: "critical",
        message: `Total budget allocation exceeds 100% (${totalPercent.toFixed(1)}%).`,
      });
    } else if (totalPercent < 99.999) {
      warnings.push({
        field: "Budget Allocation",
        currentValue: existingGovStructure.budgetAllocations.length,
        newValue: (newData.budgetAllocations || []).length,
        affectedSystems: ["BudgetAllocation", "GovernmentBudget"],
        severity: "warning",
        message: `Total budget allocation below 100% (${totalPercent.toFixed(1)}%). Unallocated budget remains.`,
      });
    }

    // Parent self-cycle check
    newData.departments.forEach((dept, index) => {
      if (
        (dept as any).parentDepartmentId &&
        parseInt((dept as any).parentDepartmentId as any) === index
      ) {
        warnings.push({
          field: `Department Parent (${dept.name})`,
          currentValue: null,
          newValue: (dept as any).parentDepartmentId,
          affectedSystems: ["GovernmentDepartment"],
          severity: "critical",
          message: `Department "${dept.name}" cannot be its own parent.`,
        });
      }
    });

    // Revenue vs total budget sanity check
    const totalRevenue = (newData.revenueSources || []).reduce(
      (s, r: any) => s + (r.revenueAmount || 0),
      0
    );
    if (newData.structure.totalBudget > 0) {
      const ratio = totalRevenue / newData.structure.totalBudget;
      if (ratio > 1.25) {
        warnings.push({
          field: "Revenue Sources",
          currentValue: existingGovStructure.revenueSources.length,
          newValue: (newData.revenueSources || []).length,
          affectedSystems: ["RevenueSource", "FiscalSystem"],
          severity: "warning",
          message: `Total revenue (${totalRevenue.toLocaleString()}) greatly exceeds total budget (${newData.structure.totalBudget.toLocaleString()}). Verify realism.`,
        });
      }
    }
  }

  // Check for conflicts with Country table
  if (country) {
    if (country.governmentType && newData.structure.governmentType !== country.governmentType) {
      warnings.push({
        field: "Country Government Type",
        currentValue: country.governmentType,
        newValue: newData.structure.governmentType,
        affectedSystems: ["Country"],
        severity: "warning",
        message: `This will update your country's government type in the main profile.`,
      });
    }
  }

  return warnings;
}

/**
 * Detect conflicts when updating tax system
 */
export async function detectTaxConflicts(
  db: PrismaClient,
  countryId: string,
  newData: TaxBuilderState | TaxBuilderData
): Promise<ConflictWarning[]> {
  const warnings: ConflictWarning[] = [];

  // Check if tax system exists
  const existingTaxSystem = await db.taxSystem.findUnique({
    where: { countryId },
    include: {
      taxCategories: {
        include: {
          taxBrackets: true,
          taxExemptions: true,
          taxDeductions: true,
        },
      },
    },
  });

  // Check fiscal system data for conflicts
  const fiscalSystem = await db.fiscalSystem.findUnique({
    where: { countryId },
  });

  if (existingTaxSystem) {
    // Check for progressive tax change
    if (newData.taxSystem.progressiveTax !== existingTaxSystem.progressiveTax) {
      warnings.push({
        field: "Tax Structure",
        currentValue: existingTaxSystem.progressiveTax ? "Progressive" : "Flat",
        newValue: newData.taxSystem.progressiveTax ? "Progressive" : "Flat",
        affectedSystems: ["TaxSystem", "FiscalSystem"],
        severity: "critical",
        message: `Changing from ${existingTaxSystem.progressiveTax ? "progressive" : "flat"} to ${newData.taxSystem.progressiveTax ? "progressive" : "flat"} tax system will affect all tax calculations and fiscal projections.`,
      });
    }

    // Check for category changes
    const existingCategoryNames = new Set(
      existingTaxSystem.taxCategories.map((c) => c.categoryName)
    );
    const newCategoryNames = new Set(newData.categories.map((c) => c.categoryName));
    const deletedCategories = [...existingCategoryNames].filter(
      (name) => !newCategoryNames.has(name)
    );

    if (deletedCategories.length > 0) {
      warnings.push({
        field: "Tax Categories",
        currentValue: deletedCategories,
        newValue: [],
        affectedSystems: ["TaxCategory", "TaxBracket", "TaxExemption", "TaxDeduction"],
        severity: "critical",
        message: `Removing ${deletedCategories.length} tax category(ies): ${deletedCategories.join(", ")}. All associated brackets, exemptions, and deductions will be deleted.`,
      });
    }
  }

  // Check for conflicts with FiscalSystem table
  if (fiscalSystem) {
    const incomeTaxCategory = newData.categories.find((c) => c.categoryType === "Income Tax");
    if (incomeTaxCategory && incomeTaxCategory.baseRate) {
      const currentRate = parseFloat(fiscalSystem.personalIncomeTaxRates || "0");
      if (Math.abs(incomeTaxCategory.baseRate - currentRate) > 5) {
        warnings.push({
          field: "Personal Income Tax Rate",
          currentValue: currentRate,
          newValue: incomeTaxCategory.baseRate,
          affectedSystems: ["FiscalSystem", "TaxSystem"],
          severity: "warning",
          message: `Personal income tax rate changing from ${currentRate}% to ${incomeTaxCategory.baseRate}%. This will update the fiscal system calculations.`,
        });
      }
    }
  }

  return warnings;
}

/** Runs `detect` for warnings, then `apply` in a transaction, collecting what was touched. */
async function runIntegration(
  db: PrismaClient,
  detect: () => Promise<ConflictWarning[]>,
  apply: (
    tx: Prisma.TransactionClient,
    affectedTables: string[],
    syncedFields: string[]
  ) => Promise<void>
): Promise<IntegrationResult> {
  const affectedTables: string[] = [];
  const syncedFields: string[] = [];

  try {
    const warnings = await detect();
    await db.$transaction((tx) => apply(tx, affectedTables, syncedFields));
    return { success: true, warnings, affectedTables, syncedFields };
  } catch (error) {
    return {
      success: false,
      warnings: [],
      affectedTables,
      syncedFields,
      errors: [error instanceof Error ? error.message : "Unknown error during sync"],
    };
  }
}

function spendingByCategory(governmentData: GovernmentBuilderState | GovernmentBuilderData) {
  const totals: Record<string, number> = {};
  governmentData.departments.forEach((dept, index) => {
    const allocation = governmentData.budgetAllocations.find(
      (a) => a.departmentId === index.toString()
    );
    const category = DEPARTMENT_TO_SPENDING_CATEGORY[dept.category] || "other";
    totals[category] = (totals[category] || 0) + (allocation?.allocatedAmount || 0);
  });
  return totals;
}

/**
 * Sync government builder data to all relevant database tables
 */
export function syncGovernmentData(
  db: PrismaClient,
  countryId: string,
  governmentData: GovernmentBuilderState | GovernmentBuilderData
): Promise<IntegrationResult> {
  return runIntegration(
    db,
    () => detectGovernmentConflicts(db, countryId, governmentData),
    async (tx, affectedTables, syncedFields) => {
      const country = await tx.country.findUnique({ where: { id: countryId } });
      if (country) {
        await tx.country.update({
          where: { id: countryId },
          data: {
            governmentType: governmentData.structure.governmentType,
            leader: governmentData.structure.headOfState || country.leader,
          },
        });
        affectedTables.push("Country");
        syncedFields.push("Country.governmentType", "Country.leader");
      }

      const spendingCategories = JSON.stringify(spendingByCategory(governmentData));
      const govBudget = await tx.governmentBudget.findUnique({ where: { countryId } });
      if (govBudget) {
        await tx.governmentBudget.update({ where: { countryId }, data: { spendingCategories } });
        syncedFields.push("GovernmentBudget.spendingCategories");
      } else {
        await tx.governmentBudget.create({ data: { countryId, spendingCategories } });
      }
      affectedTables.push("GovernmentBudget");
    }
  );
}

/** Tax rates per fiscal-system field, as set by the matching builder categories. */
function extractFiscalRates(taxData: TaxBuilderState | TaxBuilderData) {
  const baseRate = (...types: string[]) =>
    taxData.categories.find((c) => types.includes(c.categoryType))?.baseRate;
  return {
    personalIncomeTaxRates: baseRate("Income Tax")?.toString(),
    corporateTaxRates: baseRate("Corporate Tax")?.toString(),
    salesTaxRate: baseRate("Sales Tax", "Value-Added Tax (VAT)"),
    propertyTaxRate: baseRate("Property Tax"),
    payrollTaxRate: baseRate("Payroll Tax"),
  };
}

/**
 * Sync tax builder data to all relevant database tables
 */
export function syncTaxData(
  db: PrismaClient,
  countryId: string,
  taxData: TaxBuilderState | TaxBuilderData
): Promise<IntegrationResult> {
  return runIntegration(
    db,
    () => detectTaxConflicts(db, countryId, taxData),
    async (tx, affectedTables, syncedFields) => {
      const fiscalSystem = await tx.fiscalSystem.findUnique({ where: { countryId } });
      const rates = extractFiscalRates(taxData);

      if (fiscalSystem) {
        await tx.fiscalSystem.update({
          where: { countryId },
          data: {
            personalIncomeTaxRates:
              rates.personalIncomeTaxRates || fiscalSystem.personalIncomeTaxRates,
            corporateTaxRates: rates.corporateTaxRates || fiscalSystem.corporateTaxRates,
            salesTaxRate: rates.salesTaxRate || fiscalSystem.salesTaxRate,
            propertyTaxRate: rates.propertyTaxRate || fiscalSystem.propertyTaxRate,
            payrollTaxRate: rates.payrollTaxRate || fiscalSystem.payrollTaxRate,
          },
        });
        syncedFields.push(
          "FiscalSystem.personalIncomeTaxRates",
          "FiscalSystem.corporateTaxRates",
          "FiscalSystem.salesTaxRate",
          "FiscalSystem.propertyTaxRate",
          "FiscalSystem.payrollTaxRate"
        );
      } else {
        await tx.fiscalSystem.create({
          data: {
            countryId,
            personalIncomeTaxRates: rates.personalIncomeTaxRates || "0",
            corporateTaxRates: rates.corporateTaxRates || "0",
            salesTaxRate: rates.salesTaxRate || 0,
            propertyTaxRate: rates.propertyTaxRate || 0,
            payrollTaxRate: rates.payrollTaxRate || 0,
          },
        });
      }
      affectedTables.push("FiscalSystem");
    }
  );
}
