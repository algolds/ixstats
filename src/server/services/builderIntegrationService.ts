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
import { TAX_RATE_LIMITS, type RateLimit } from "~/lib/economy/tax-rate-limits";
import type { TaxBuilderState } from "~/types/builder";

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

/** Tax rates per fiscal-system field, as set by the matching builder categories. */
function extractFiscalRates(taxData: TaxBuilderState | TaxBuilderData) {
  const baseRate = (...types: string[]) =>
    taxData.categories.find((c) => types.includes(c.categoryType))?.baseRate;
  // The Fiscal policy console's channel ranges bound these rates too, whichever way they are saved.
  const within = (rate: number | undefined, { max }: RateLimit) =>
    rate === undefined ? undefined : Math.min(rate, max);
  return {
    personalIncomeTaxRates: within(baseRate("Income Tax"), TAX_RATE_LIMITS.income)?.toString(),
    corporateTaxRates: within(baseRate("Corporate Tax"), TAX_RATE_LIMITS.corporate)?.toString(),
    salesTaxRate: within(baseRate("Sales Tax", "Value-Added Tax (VAT)"), TAX_RATE_LIMITS.vat),
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
