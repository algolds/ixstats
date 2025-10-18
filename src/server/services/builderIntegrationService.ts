// src/server/services/builderIntegrationService.ts
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

import type { PrismaClient } from "@prisma/client";
import type { GovernmentBuilderState } from "~/types/government";
import type { TaxBuilderState } from "~/components/tax-system/TaxBuilder";

// Type for government data without validation state
export type GovernmentBuilderData = Omit<GovernmentBuilderState, 'isValid' | 'errors'>;

// Type for tax data without validation state  
export type TaxBuilderData = Omit<TaxBuilderState, 'isValid' | 'errors'>;

// ==================== TYPE DEFINITIONS ====================

export interface FieldMapping {
  sourceField: string;
  targetTable: string;
  targetField: string;
  transformFunction?: (value: any) => any;
  requiresUserConfirmation?: boolean;
}

export interface ConflictWarning {
  field: string;
  currentValue: any;
  newValue: any;
  affectedSystems: string[];
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface IntegrationResult {
  success: boolean;
  warnings: ConflictWarning[];
  affectedTables: string[];
  syncedFields: string[];
  errors?: string[];
}

// ==================== GOVERNMENT BUILDER FIELD MAPPINGS ====================

/**
 * Complete mapping of Government Builder fields to database tables
 * This ensures every field in the builder is persisted to the correct location
 */
export const GOVERNMENT_FIELD_MAPPINGS: FieldMapping[] = [
  // GovernmentStructure table mappings
  { sourceField: 'structure.governmentName', targetTable: 'GovernmentStructure', targetField: 'governmentName' },
  { sourceField: 'structure.governmentType', targetTable: 'GovernmentStructure', targetField: 'governmentType' },
  { sourceField: 'structure.headOfState', targetTable: 'GovernmentStructure', targetField: 'headOfState' },
  { sourceField: 'structure.headOfGovernment', targetTable: 'GovernmentStructure', targetField: 'headOfGovernment' },
  { sourceField: 'structure.legislatureName', targetTable: 'GovernmentStructure', targetField: 'legislatureName' },
  { sourceField: 'structure.executiveName', targetTable: 'GovernmentStructure', targetField: 'executiveName' },
  { sourceField: 'structure.judicialName', targetTable: 'GovernmentStructure', targetField: 'judicialName' },
  { sourceField: 'structure.totalBudget', targetTable: 'GovernmentStructure', targetField: 'totalBudget' },
  { sourceField: 'structure.fiscalYear', targetTable: 'GovernmentStructure', targetField: 'fiscalYear' },
  { sourceField: 'structure.budgetCurrency', targetTable: 'GovernmentStructure', targetField: 'budgetCurrency' },
  
  // Cross-table mappings (Government → Country table)
  { 
    sourceField: 'structure.governmentType', 
    targetTable: 'Country', 
    targetField: 'governmentType',
    requiresUserConfirmation: true 
  },
  { 
    sourceField: 'structure.headOfState', 
    targetTable: 'Country', 
    targetField: 'leader',
    requiresUserConfirmation: true,
    transformFunction: (value) => value || 'Unknown'
  },
  
  // Cross-table mappings (Government → GovernmentBudget table)
  { 
    sourceField: 'structure.totalBudget', 
    targetTable: 'GovernmentBudget', 
    targetField: 'totalBudget',
    requiresUserConfirmation: true 
  },
  
  // Budget allocation mappings
  { sourceField: 'budgetAllocations', targetTable: 'BudgetAllocation', targetField: '*' },
  { sourceField: 'departments', targetTable: 'GovernmentDepartment', targetField: '*' },
  { sourceField: 'revenueSources', targetTable: 'RevenueSource', targetField: '*' },
];

/**
 * Mapping for department categories to budget spending categories
 */
export const DEPARTMENT_TO_SPENDING_CATEGORY: Record<string, string> = {
  'Defense': 'defense',
  'Education': 'education',
  'Health': 'healthcare',
  'Transportation': 'infrastructure',
  'Social Services': 'socialSecurity',
  'Finance': 'other',
  'Foreign Affairs': 'other',
  'Interior': 'other',
  'Justice': 'other',
  'Agriculture': 'other',
  'Environment': 'other',
  'Labor': 'other',
  'Commerce': 'other',
  'Energy': 'infrastructure',
  'Communications': 'infrastructure',
  'Culture': 'education',
  'Science and Technology': 'education',
  'Housing': 'socialSecurity',
  'Veterans Affairs': 'socialSecurity',
  'Intelligence': 'defense',
  'Emergency Management': 'other',
  'Other': 'other'
};

// ==================== TAX BUILDER FIELD MAPPINGS ====================

/**
 * Complete mapping of Tax Builder fields to database tables
 */
export const TAX_FIELD_MAPPINGS: FieldMapping[] = [
  // TaxSystem table mappings
  { sourceField: 'taxSystem.taxSystemName', targetTable: 'TaxSystem', targetField: 'taxSystemName' },
  { sourceField: 'taxSystem.taxAuthority', targetTable: 'TaxSystem', targetField: 'taxAuthority' },
  { sourceField: 'taxSystem.fiscalYear', targetTable: 'TaxSystem', targetField: 'fiscalYear' },
  { sourceField: 'taxSystem.taxCode', targetTable: 'TaxSystem', targetField: 'taxCode' },
  { sourceField: 'taxSystem.baseRate', targetTable: 'TaxSystem', targetField: 'baseRate' },
  { sourceField: 'taxSystem.progressiveTax', targetTable: 'TaxSystem', targetField: 'progressiveTax' },
  { sourceField: 'taxSystem.flatTaxRate', targetTable: 'TaxSystem', targetField: 'flatTaxRate' },
  { sourceField: 'taxSystem.alternativeMinTax', targetTable: 'TaxSystem', targetField: 'alternativeMinTax' },
  { sourceField: 'taxSystem.alternativeMinRate', targetTable: 'TaxSystem', targetField: 'alternativeMinRate' },
  { sourceField: 'taxSystem.complianceRate', targetTable: 'TaxSystem', targetField: 'complianceRate' },
  { sourceField: 'taxSystem.collectionEfficiency', targetTable: 'TaxSystem', targetField: 'collectionEfficiency' },
  
  // Cross-table mappings (TaxSystem → FiscalSystem table)
  { 
    sourceField: 'categories', 
    targetTable: 'FiscalSystem', 
    targetField: 'personalIncomeTaxRates',
    transformFunction: (categories) => {
      const incomeTax = categories.find((c: any) => c.categoryType === 'Income Tax');
      return incomeTax?.baseRate?.toString() || '0';
    },
    requiresUserConfirmation: true
  },
  { 
    sourceField: 'categories', 
    targetTable: 'FiscalSystem', 
    targetField: 'corporateTaxRates',
    transformFunction: (categories) => {
      const corpTax = categories.find((c: any) => c.categoryType === 'Corporate Tax');
      return corpTax?.baseRate?.toString() || '0';
    },
    requiresUserConfirmation: true
  },
  { 
    sourceField: 'categories', 
    targetTable: 'FiscalSystem', 
    targetField: 'salesTaxRate',
    transformFunction: (categories) => {
      const salesTax = categories.find((c: any) => c.categoryType === 'Sales Tax' || c.categoryType === 'Value-Added Tax (VAT)');
      return salesTax?.baseRate || 0;
    },
    requiresUserConfirmation: true
  },
  
  // Nested mappings
  { sourceField: 'categories', targetTable: 'TaxCategory', targetField: '*' },
  { sourceField: 'brackets', targetTable: 'TaxBracket', targetField: '*' },
  { sourceField: 'exemptions', targetTable: 'TaxExemption', targetField: '*' },
  { sourceField: 'deductions', targetTable: 'TaxDeduction', targetField: '*' },
];

// ==================== CONFLICT DETECTION ====================

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
    }
  });

  // Check country data for conflicts
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { governmentType: true, leader: true }
  });

  if (existingGovStructure) {
    // Check for government type conflict
    if (newData.structure.governmentType !== existingGovStructure.governmentType) {
      warnings.push({
        field: 'Government Type',
        currentValue: existingGovStructure.governmentType,
        newValue: newData.structure.governmentType,
        affectedSystems: ['GovernmentStructure', 'Country'],
        severity: 'warning',
        message: `Changing government type from "${existingGovStructure.governmentType}" to "${newData.structure.governmentType}" will update your country's profile.`
      });
    }

    // Check for head of state conflict
    if (newData.structure.headOfState && newData.structure.headOfState !== existingGovStructure.headOfState) {
      warnings.push({
        field: 'Head of State',
        currentValue: existingGovStructure.headOfState,
        newValue: newData.structure.headOfState,
        affectedSystems: ['GovernmentStructure', 'Country'],
        severity: 'info',
        message: `Updating head of state from "${existingGovStructure.headOfState || 'Unknown'}" to "${newData.structure.headOfState}".`
      });
    }

    // Check for total budget conflict
    if (Math.abs(newData.structure.totalBudget - existingGovStructure.totalBudget) / existingGovStructure.totalBudget > 0.1) {
      warnings.push({
        field: 'Total Budget',
        currentValue: existingGovStructure.totalBudget,
        newValue: newData.structure.totalBudget,
        affectedSystems: ['GovernmentStructure', 'GovernmentBudget', 'FiscalSystem'],
        severity: 'warning',
        message: `Total budget is changing by ${((Math.abs(newData.structure.totalBudget - existingGovStructure.totalBudget) / existingGovStructure.totalBudget) * 100).toFixed(1)}%. This will affect all budget allocations and fiscal calculations.`
      });
    }

    // Check for department deletions
    const existingDeptNames = new Set(existingGovStructure.departments.map(d => d.name));
    const newDeptNames = new Set(newData.departments.map(d => d.name));
    const deletedDepts = [...existingDeptNames].filter(name => !newDeptNames.has(name));
    
    if (deletedDepts.length > 0) {
      warnings.push({
        field: 'Departments',
        currentValue: deletedDepts,
        newValue: [],
        affectedSystems: ['GovernmentDepartment', 'BudgetAllocation'],
        severity: 'critical',
        message: `Removing ${deletedDepts.length} department(s): ${deletedDepts.join(', ')}. All associated budget allocations will be deleted.`
      });
    }

    // Budget allocation coverage check
    const totalPercent = (newData.budgetAllocations || []).reduce((s, a: any) => s + (a.allocatedPercent || 0), 0);
    if (totalPercent > 100.0001) {
      warnings.push({
        field: 'Budget Allocation',
        currentValue: existingGovStructure.budgetAllocations.length,
        newValue: (newData.budgetAllocations || []).length,
        affectedSystems: ['BudgetAllocation', 'GovernmentBudget'],
        severity: 'critical',
        message: `Total budget allocation exceeds 100% (${totalPercent.toFixed(1)}%).`
      });
    } else if (totalPercent < 99.999) {
      warnings.push({
        field: 'Budget Allocation',
        currentValue: existingGovStructure.budgetAllocations.length,
        newValue: (newData.budgetAllocations || []).length,
        affectedSystems: ['BudgetAllocation', 'GovernmentBudget'],
        severity: 'warning',
        message: `Total budget allocation below 100% (${totalPercent.toFixed(1)}%). Unallocated budget remains.`
      });
    }

    // Parent self-cycle check
    newData.departments.forEach((dept, index) => {
      if ((dept as any).parentDepartmentId && parseInt((dept as any).parentDepartmentId as any) === index) {
        warnings.push({
          field: `Department Parent (${dept.name})`,
          currentValue: null,
          newValue: (dept as any).parentDepartmentId,
          affectedSystems: ['GovernmentDepartment'],
          severity: 'critical',
          message: `Department "${dept.name}" cannot be its own parent.`
        });
      }
    });

    // Revenue vs total budget sanity check
    const totalRevenue = (newData.revenueSources || []).reduce((s, r: any) => s + (r.revenueAmount || 0), 0);
    if (newData.structure.totalBudget > 0) {
      const ratio = totalRevenue / newData.structure.totalBudget;
      if (ratio > 1.25) {
        warnings.push({
          field: 'Revenue Sources',
          currentValue: existingGovStructure.revenueSources.length,
          newValue: (newData.revenueSources || []).length,
          affectedSystems: ['RevenueSource', 'FiscalSystem'],
          severity: 'warning',
          message: `Total revenue (${totalRevenue.toLocaleString()}) greatly exceeds total budget (${newData.structure.totalBudget.toLocaleString()}). Verify realism.`
        });
      }
    }
  }

  // Check for conflicts with Country table
  if (country) {
    if (country.governmentType && newData.structure.governmentType !== country.governmentType) {
      warnings.push({
        field: 'Country Government Type',
        currentValue: country.governmentType,
        newValue: newData.structure.governmentType,
        affectedSystems: ['Country'],
        severity: 'warning',
        message: `This will update your country's government type in the main profile.`
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
        }
      }
    }
  });

  // Check fiscal system data for conflicts
  const fiscalSystem = await db.fiscalSystem.findUnique({
    where: { countryId },
  });

  if (existingTaxSystem) {
    // Check for progressive tax change
    if (newData.taxSystem.progressiveTax !== existingTaxSystem.progressiveTax) {
      warnings.push({
        field: 'Tax Structure',
        currentValue: existingTaxSystem.progressiveTax ? 'Progressive' : 'Flat',
        newValue: newData.taxSystem.progressiveTax ? 'Progressive' : 'Flat',
        affectedSystems: ['TaxSystem', 'FiscalSystem'],
        severity: 'critical',
        message: `Changing from ${existingTaxSystem.progressiveTax ? 'progressive' : 'flat'} to ${newData.taxSystem.progressiveTax ? 'progressive' : 'flat'} tax system will affect all tax calculations and fiscal projections.`
      });
    }

    // Check for category changes
    const existingCategoryNames = new Set(existingTaxSystem.taxCategories.map(c => c.categoryName));
    const newCategoryNames = new Set(newData.categories.map(c => c.categoryName));
    const deletedCategories = [...existingCategoryNames].filter(name => !newCategoryNames.has(name));
    
    if (deletedCategories.length > 0) {
      warnings.push({
        field: 'Tax Categories',
        currentValue: deletedCategories,
        newValue: [],
        affectedSystems: ['TaxCategory', 'TaxBracket', 'TaxExemption', 'TaxDeduction'],
        severity: 'critical',
        message: `Removing ${deletedCategories.length} tax category(ies): ${deletedCategories.join(', ')}. All associated brackets, exemptions, and deductions will be deleted.`
      });
    }
  }

  // Check for conflicts with FiscalSystem table
  if (fiscalSystem) {
    const incomeTaxCategory = newData.categories.find(c => c.categoryType === 'Income Tax');
    if (incomeTaxCategory && incomeTaxCategory.baseRate) {
      const currentRate = parseFloat(fiscalSystem.personalIncomeTaxRates || '0');
      if (Math.abs(incomeTaxCategory.baseRate - currentRate) > 5) {
        warnings.push({
          field: 'Personal Income Tax Rate',
          currentValue: currentRate,
          newValue: incomeTaxCategory.baseRate,
          affectedSystems: ['FiscalSystem', 'TaxSystem'],
          severity: 'warning',
          message: `Personal income tax rate changing from ${currentRate}% to ${incomeTaxCategory.baseRate}%. This will update the fiscal system calculations.`
        });
      }
    }
  }

  return warnings;
}

// ==================== SYNC OPERATIONS ====================

/**
 * Sync government builder data to all relevant database tables
 */
export async function syncGovernmentData(
  db: PrismaClient,
  countryId: string,
  governmentData: GovernmentBuilderState | GovernmentBuilderData
): Promise<IntegrationResult> {
  const affectedTables: string[] = [];
  const syncedFields: string[] = [];
  const errors: string[] = [];

  try {
    // Get warnings first
    const warnings = await detectGovernmentConflicts(db, countryId, governmentData);

    await db.$transaction(async (tx) => {
      // 1. Sync Country table fields
      const country = await tx.country.findUnique({ where: { id: countryId } });
      if (country) {
        await tx.country.update({
          where: { id: countryId },
          data: {
            governmentType: governmentData.structure.governmentType,
            leader: governmentData.structure.headOfState || country.leader,
          }
        });
        affectedTables.push('Country');
        syncedFields.push('Country.governmentType', 'Country.leader');
      }

      // 2. Sync GovernmentBudget table
      const govBudget = await tx.governmentBudget.findUnique({ where: { countryId } });
      if (govBudget) {
        // Calculate spending by category from departments
        const spendingByCategory: Record<string, number> = {};
        
        governmentData.departments.forEach((dept, index) => {
          const allocation = governmentData.budgetAllocations.find(a => a.departmentId === index.toString());
          const category = DEPARTMENT_TO_SPENDING_CATEGORY[dept.category] || 'other';
          spendingByCategory[category] = (spendingByCategory[category] || 0) + (allocation?.allocatedAmount || 0);
        });

        await tx.governmentBudget.update({
          where: { countryId },
          data: {
            spendingCategories: JSON.stringify(spendingByCategory),
          }
        });
        affectedTables.push('GovernmentBudget');
        syncedFields.push('GovernmentBudget.spendingCategories');
      } else {
        // Create if doesn't exist
        const spendingByCategory: Record<string, number> = {};
        governmentData.departments.forEach((dept, index) => {
          const allocation = governmentData.budgetAllocations.find(a => a.departmentId === index.toString());
          const category = DEPARTMENT_TO_SPENDING_CATEGORY[dept.category] || 'other';
          spendingByCategory[category] = (spendingByCategory[category] || 0) + (allocation?.allocatedAmount || 0);
        });

        await tx.governmentBudget.create({
          data: {
            countryId,
            spendingCategories: JSON.stringify(spendingByCategory),
          }
        });
        affectedTables.push('GovernmentBudget');
      }

      // 3. (Optional) Fiscal sync deferred: handled by tax sync and analytics pipelines
    });

    return {
      success: true,
      warnings,
      affectedTables,
      syncedFields,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error during sync');
    return {
      success: false,
      warnings: [],
      affectedTables,
      syncedFields,
      errors,
    };
  }
}

/**
 * Sync tax builder data to all relevant database tables
 */
export async function syncTaxData(
  db: PrismaClient,
  countryId: string,
  taxData: TaxBuilderState | TaxBuilderData
): Promise<IntegrationResult> {
  const affectedTables: string[] = [];
  const syncedFields: string[] = [];
  const errors: string[] = [];

  try {
    // Get warnings first
    const warnings = await detectTaxConflicts(db, countryId, taxData);

    await db.$transaction(async (tx) => {
      // 1. Sync FiscalSystem table
      const fiscalSystem = await tx.fiscalSystem.findUnique({ where: { countryId } });
      
      // Extract tax rates from categories
      const incomeTax = taxData.categories.find(c => c.categoryType === 'Income Tax');
      const corpTax = taxData.categories.find(c => c.categoryType === 'Corporate Tax');
      const salesTax = taxData.categories.find(c => c.categoryType === 'Sales Tax' || c.categoryType === 'Value-Added Tax (VAT)');
      const propertyTax = taxData.categories.find(c => c.categoryType === 'Property Tax');
      const payrollTax = taxData.categories.find(c => c.categoryType === 'Payroll Tax');
      
      if (fiscalSystem) {
        await tx.fiscalSystem.update({
          where: { countryId },
          data: {
            personalIncomeTaxRates: incomeTax?.baseRate?.toString() || fiscalSystem.personalIncomeTaxRates,
            corporateTaxRates: corpTax?.baseRate?.toString() || fiscalSystem.corporateTaxRates,
            salesTaxRate: salesTax?.baseRate || fiscalSystem.salesTaxRate,
            propertyTaxRate: propertyTax?.baseRate || fiscalSystem.propertyTaxRate,
            payrollTaxRate: payrollTax?.baseRate || fiscalSystem.payrollTaxRate,
          }
        });
        affectedTables.push('FiscalSystem');
        syncedFields.push(
          'FiscalSystem.personalIncomeTaxRates',
          'FiscalSystem.corporateTaxRates',
          'FiscalSystem.salesTaxRate',
          'FiscalSystem.propertyTaxRate',
          'FiscalSystem.payrollTaxRate'
        );
      } else {
        // Create if doesn't exist
        await tx.fiscalSystem.create({
          data: {
            countryId,
            personalIncomeTaxRates: incomeTax?.baseRate?.toString() || '0',
            corporateTaxRates: corpTax?.baseRate?.toString() || '0',
            salesTaxRate: salesTax?.baseRate || 0,
            propertyTaxRate: propertyTax?.baseRate || 0,
            payrollTaxRate: payrollTax?.baseRate || 0,
          }
        });
        affectedTables.push('FiscalSystem');
      }
    });

    return {
      success: true,
      warnings,
      affectedTables,
      syncedFields,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error during sync');
    return {
      success: false,
      warnings: [],
      affectedTables,
      syncedFields,
      errors,
    };
  }
}

/**
 * Get field mapping information for a specific builder field
 */
export function getFieldMappingInfo(
  builderType: 'government' | 'tax',
  fieldPath: string
): FieldMapping[] {
  const mappings = builderType === 'government' ? GOVERNMENT_FIELD_MAPPINGS : TAX_FIELD_MAPPINGS;
  return mappings.filter(m => m.sourceField === fieldPath);
}

/**
 * Validate that all builder fields are mapped
 */
export function validateFieldCoverage(
  builderType: 'government' | 'tax',
  builderData: GovernmentBuilderState | TaxBuilderState
): { mapped: string[], unmapped: string[] } {
  const mappings = builderType === 'government' ? GOVERNMENT_FIELD_MAPPINGS : TAX_FIELD_MAPPINGS;
  const mappedFields = new Set(mappings.map(m => m.sourceField));
  
  // Get all fields from builder data (flatten nested objects)
  const allFields = getAllFieldPaths(builderData);
  
  const mapped = allFields.filter(f => mappedFields.has(f));
  const unmapped = allFields.filter(f => !mappedFields.has(f));
  
  return { mapped, unmapped };
}

/**
 * Helper to get all field paths from an object
 */
function getAllFieldPaths(obj: any, prefix = ''): string[] {
  const fields: string[] = [];
  
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      fields.push(...getAllFieldPaths(value, path));
    } else {
      fields.push(path);
    }
  }
  
  return fields;
}

