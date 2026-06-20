/**
 * Government Builder Validation Utilities
 *
 * Pure functions for validating government structures, departments,
 * budget allocations, and revenue sources.
 *
 * @module government-builder-validation
 */

import type {
  GovernmentBuilderState,
  GovernmentStructureInput,
  DepartmentInput,
  BudgetAllocationInput,
  RevenueSourceInput,
} from "~/types/government";

// ==================== TYPES ====================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

export interface ValidationErrors {
  structure?: string[];
  departments?: Record<number, string[]>;
  budget?: string[];
  revenue?: Record<number, string[]>;
}

export interface BudgetSummary {
  totalAllocated: number;
  totalAllocatedPercent: number;
  remaining: number;
  remainingPercent: number;
  isOverBudget: boolean;
  isUnderBudget: boolean;
}

export interface GovernmentSummary {
  name: string;
  type: string;
  fiscalYear: string;
  totalBudget: number;
  currency: string;
  departmentCount: number;
  allocationCount: number;
  revenueSourceCount: number;
  totalRevenue: number;
  budgetUtilization: number;
  isBalanced: boolean;
}

// ==================== STRUCTURE VALIDATION ====================

/**
 * Validates government name
 */
export function validateGovernmentName(name: string | undefined): string | null {
  if (!name || !name.trim()) {
    return "Government name is required";
  }
  if (name.length < 2) {
    return "Government name must be at least 2 characters";
  }
  if (name.length > 200) {
    return "Government name must be less than 200 characters";
  }
  return null;
}

/**
 * Validates total budget
 */
export function validateTotalBudget(budget: number | undefined): string | null {
  if (budget === undefined || budget === null) {
    return "Total budget is required";
  }
  if (budget <= 0) {
    return "Total budget must be greater than 0";
  }
  if (budget > Number.MAX_SAFE_INTEGER) {
    return "Total budget exceeds maximum safe value";
  }
  return null;
}

/**
 * Validates currency code
 */
export function validateCurrency(currency: string | undefined): string | null {
  if (!currency || !currency.trim()) {
    return "Currency is required";
  }
  if (currency.length !== 3) {
    return "Currency must be a 3-letter code (e.g., USD, EUR)";
  }
  return null;
}

/**
 * Validates fiscal year
 */
export function validateFiscalYear(fiscalYear: string | undefined): string | null {
  if (!fiscalYear || !fiscalYear.trim()) {
    return "Fiscal year is required";
  }
  return null;
}

/**
 * Validates complete government structure
 */
export function validateGovernmentStructure(structure: GovernmentStructureInput): string[] {
  const errors: string[] = [];

  const nameError = validateGovernmentName(structure.governmentName);
  if (nameError) errors.push(nameError);

  const budgetError = validateTotalBudget(structure.totalBudget);
  if (budgetError) errors.push(budgetError);

  const currencyError = validateCurrency(structure.budgetCurrency);
  if (currencyError) errors.push(currencyError);

  const fiscalYearError = validateFiscalYear(structure.fiscalYear);
  if (fiscalYearError) errors.push(fiscalYearError);

  return errors;
}

// ==================== DEPARTMENT VALIDATION ====================

/**
 * Validates department name
 */
export function validateDepartmentName(name: string | undefined): string | null {
  if (!name || !name.trim()) {
    return "Department name is required";
  }
  if (name.length < 2) {
    return "Department name must be at least 2 characters";
  }
  if (name.length > 200) {
    return "Department name must be less than 200 characters";
  }
  return null;
}

/**
 * Validates department category
 */
export function validateDepartmentCategory(category: string | undefined): string | null {
  if (!category || !category.trim()) {
    return "Department category is required";
  }
  return null;
}

/**
 * Validates organizational level
 */
export function validateOrganizationalLevel(level: string | undefined): string | null {
  if (!level || !level.trim()) {
    return "Organizational level is required";
  }
  return null;
}

/**
 * Validates hex color code
 */
export function validateColor(color: string | undefined): string | null {
  if (!color) return null; // Color is optional

  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return "Color must be a valid hex code (e.g., #FF5733)";
  }
  return null;
}

/**
 * Validates priority level
 */
export function validatePriority(priority: number | undefined): string | null {
  if (priority === undefined) return null; // Priority is optional

  if (priority < 1 || priority > 100) {
    return "Priority must be between 1 and 100";
  }
  return null;
}

/**
 * Validates parent department reference
 */
export function validateParentDepartment(
  parentId: string | undefined,
  currentIndex: number
): string | null {
  if (!parentId) return null; // Parent is optional

  const parsedId = parseInt(parentId);
  if (isNaN(parsedId)) {
    return "Invalid parent department ID";
  }

  if (parsedId === currentIndex) {
    return "Department cannot be its own parent";
  }

  return null;
}

/**
 * Validates a single department
 */
export function validateDepartment(department: DepartmentInput, index: number): string[] {
  const errors: string[] = [];

  const nameError = validateDepartmentName(department.name);
  if (nameError) errors.push(nameError);

  const categoryError = validateDepartmentCategory(department.category);
  if (categoryError) errors.push(categoryError);

  const levelError = validateOrganizationalLevel(department.organizationalLevel);
  if (levelError) errors.push(levelError);

  const colorError = validateColor(department.color);
  if (colorError) errors.push(colorError);

  const priorityError = validatePriority(department.priority);
  if (priorityError) errors.push(priorityError);

  const parentError = validateParentDepartment(department.parentDepartmentId, index);
  if (parentError) errors.push(parentError);

  return errors;
}

/**
 * Checks for duplicate department names
 */
export function checkDuplicateDepartmentNames(
  departments: DepartmentInput[]
): Map<number, string[]> {
  const errors = new Map<number, string[]>();
  const nameCount = new Map<string, number[]>();

  departments.forEach((dept, index) => {
    if (!dept.name) return;

    const normalizedName = dept.name.trim().toLowerCase();
    if (!nameCount.has(normalizedName)) {
      nameCount.set(normalizedName, []);
    }
    nameCount.get(normalizedName)!.push(index);
  });

  nameCount.forEach((indices, name) => {
    if (indices.length > 1) {
      indices.forEach((index) => {
        if (!errors.has(index)) {
          errors.set(index, []);
        }
        errors.get(index)!.push("Duplicate department name detected");
      });
    }
  });

  return errors;
}

/**
 * Validates department count
 */
export function validateDepartmentCount(count: number): string | null {
  if (count < 1) {
    return "At least one department is required";
  }
  if (count > 100) {
    return "Maximum 100 departments allowed";
  }
  return null;
}

// ==================== BUDGET VALIDATION ====================

/**
 * Validates budget allocation amount
 */
export function validateBudgetAmount(
  amount: number | undefined,
  totalBudget: number
): string | null {
  if (amount === undefined || amount === null) {
    return "Budget amount is required";
  }
  if (amount < 0) {
    return "Budget amount cannot be negative";
  }
  if (amount > totalBudget) {
    return "Budget amount exceeds total budget";
  }
  return null;
}

/**
 * Validates budget allocation percentage
 */
export function validateBudgetPercentage(percent: number | undefined): string | null {
  if (percent === undefined || percent === null) {
    return "Budget percentage is required";
  }
  if (percent < 0) {
    return "Budget percentage cannot be negative";
  }
  if (percent > 100) {
    return "Budget percentage cannot exceed 100%";
  }
  return null;
}

/**
 * Validates amount/percentage coherence
 */
export function validateBudgetCoherence(
  amount: number,
  percent: number,
  totalBudget: number
): string | null {
  const expectedAmount = (totalBudget * percent) / 100;
  const tolerance = Math.max(1, totalBudget * 0.0001);

  if (Math.abs(amount - expectedAmount) > tolerance) {
    return "Budget amount does not match percentage";
  }
  return null;
}

/**
 * Calculates total budget allocation
 */
export function calculateTotalBudget(allocations: BudgetAllocationInput[]): number {
  return allocations.reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0);
}

/**
 * Calculates total budget percentage
 */
export function calculateTotalBudgetPercent(allocations: BudgetAllocationInput[]): number {
  return allocations.reduce((sum, alloc) => sum + (alloc.allocatedPercent || 0), 0);
}

/**
 * Calculates budget percentage for amount
 */
export function calculateBudgetPercentage(amount: number, totalBudget: number): number {
  if (totalBudget <= 0) return 0;
  return (amount / totalBudget) * 100;
}

/**
 * Detects budget overruns
 */
export function detectBudgetOverruns(
  allocations: BudgetAllocationInput[],
  totalBudget: number
): string[] {
  const warnings: string[] = [];
  const totalAllocated = calculateTotalBudget(allocations);
  const totalPercent = calculateTotalBudgetPercent(allocations);

  if (totalPercent > 100 + 1e-6) {
    warnings.push(`Total budget allocation exceeds 100% (${totalPercent.toFixed(2)}%)`);
  }

  if (totalAllocated > totalBudget) {
    const overage = totalAllocated - totalBudget;
    warnings.push(`Budget overage: ${overage.toLocaleString()} over total budget`);
  }

  return warnings;
}

/**
 * Generates budget summary
 */
export function generateBudgetSummary(
  allocations: BudgetAllocationInput[],
  totalBudget: number
): BudgetSummary {
  const totalAllocated = calculateTotalBudget(allocations);
  const totalAllocatedPercent = calculateTotalBudgetPercent(allocations);
  const remaining = totalBudget - totalAllocated;
  const remainingPercent = 100 - totalAllocatedPercent;

  return {
    totalAllocated,
    totalAllocatedPercent,
    remaining,
    remainingPercent,
    isOverBudget: totalAllocatedPercent > 100,
    isUnderBudget: totalAllocatedPercent < 100,
  };
}

// ==================== REVENUE VALIDATION ====================

/**
 * Validates revenue source name
 */
export function validateRevenueName(name: string | undefined): string | null {
  if (!name || !name.trim()) {
    return "Revenue name is required";
  }
  if (name.length < 2) {
    return "Revenue name must be at least 2 characters";
  }
  if (name.length > 200) {
    return "Revenue name must be less than 200 characters";
  }
  return null;
}

/**
 * Validates revenue category
 */
export function validateRevenueCategory(category: string | undefined): string | null {
  if (!category || !category.trim()) {
    return "Revenue category is required";
  }
  return null;
}

/**
 * Validates revenue amount
 */
export function validateRevenueAmount(amount: number | undefined): string | null {
  if (amount === undefined || amount === null) {
    return "Revenue amount is required";
  }
  if (amount < 0) {
    return "Revenue amount cannot be negative";
  }
  if (amount > Number.MAX_SAFE_INTEGER) {
    return "Revenue amount exceeds maximum safe value";
  }
  return null;
}

/**
 * Validates tax rate
 */
export function validateTaxRate(rate: number | undefined): string | null {
  if (rate === undefined) return null; // Rate is optional

  if (rate < 0 || rate > 100) {
    return "Tax rate must be between 0 and 100";
  }
  return null;
}

/**
 * Validates a single revenue source
 */
export function validateRevenueSource(revenue: RevenueSourceInput): string[] {
  const errors: string[] = [];

  const nameError = validateRevenueName(revenue.name);
  if (nameError) errors.push(nameError);

  const categoryError = validateRevenueCategory(revenue.category);
  if (categoryError) errors.push(categoryError);

  const amountError = validateRevenueAmount(revenue.revenueAmount);
  if (amountError) errors.push(amountError);

  const rateError = validateTaxRate(revenue.rate);
  if (rateError) errors.push(rateError);

  return errors;
}

/**
 * Calculates total revenue
 */
export function calculateTotalRevenue(revenueSources: RevenueSourceInput[]): number {
  return revenueSources.reduce((sum, source) => sum + (source.revenueAmount || 0), 0);
}

/**
 * Checks revenue-budget balance
 */
export function checkRevenueBudgetBalance(
  revenueSources: RevenueSourceInput[],
  totalBudget: number
): string | null {
  const totalRevenue = calculateTotalRevenue(revenueSources);
  const tolerance = Math.max(1000, totalBudget * 0.01); // 1% tolerance

  if (Math.abs(totalRevenue - totalBudget) > tolerance) {
    const diff = totalRevenue - totalBudget;
    if (diff > 0) {
      return `Revenue surplus: ${diff.toLocaleString()}`;
    } else {
      return `Revenue deficit: ${Math.abs(diff).toLocaleString()}`;
    }
  }
  return null;
}

// ==================== COMPLETE VALIDATION ====================

/**
 * Validates complete government builder state
 */
export function validateGovernmentBuilderState(state: GovernmentBuilderState): ValidationResult {
  const errors: ValidationErrors = {};

  // Validate structure
  const structureErrors = validateGovernmentStructure(state.structure);
  if (structureErrors.length > 0) {
    errors.structure = structureErrors;
  }

  // Validate departments
  const departmentErrors: Record<number, string[]> = {};
  state.departments.forEach((dept, index) => {
    const deptErrors = validateDepartment(dept, index);
    if (deptErrors.length > 0) {
      departmentErrors[index] = deptErrors;
    }
  });

  // Check for duplicate department names
  const duplicateErrors = checkDuplicateDepartmentNames(state.departments);
  duplicateErrors.forEach((errs, index) => {
    if (!departmentErrors[index]) {
      departmentErrors[index] = [];
    }
    departmentErrors[index].push(...errs);
  });

  if (Object.keys(departmentErrors).length > 0) {
    errors.departments = departmentErrors;
  }

  // Validate department count
  const countError = validateDepartmentCount(state.departments.length);
  if (countError) {
    if (!errors.structure) errors.structure = [];
    errors.structure.push(countError);
  }

  // Validate budget allocations
  const budgetErrors: string[] = [];
  const overruns = detectBudgetOverruns(state.budgetAllocations, state.structure.totalBudget);
  budgetErrors.push(...overruns);

  // Check amount/percentage coherence for each allocation
  for (const alloc of state.budgetAllocations) {
    const coherenceError = validateBudgetCoherence(
      alloc.allocatedAmount || 0,
      alloc.allocatedPercent || 0,
      state.structure.totalBudget
    );
    if (coherenceError) {
      budgetErrors.push(coherenceError);
      break; // Only report once
    }
  }

  if (budgetErrors.length > 0) {
    errors.budget = budgetErrors;
  }

  // Validate revenue sources
  const revenueErrors: Record<number, string[]> = {};
  state.revenueSources.forEach((revenue, index) => {
    const revErrors = validateRevenueSource(revenue);
    if (revErrors.length > 0) {
      revenueErrors[index] = revErrors;
    }
  });

  if (Object.keys(revenueErrors).length > 0) {
    errors.revenue = revenueErrors;
  }

  // Check revenue-budget balance (warning level)
  if (state.revenueSources.length > 0) {
    const balanceWarning = checkRevenueBudgetBalance(
      state.revenueSources,
      state.structure.totalBudget
    );
    if (balanceWarning) {
      if (!errors.budget) errors.budget = [];
      errors.budget.push(balanceWarning);
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ==================== SUMMARY GENERATION ====================

/**
 * Generates comprehensive government summary
 */
export function generateGovernmentSummary(state: GovernmentBuilderState): GovernmentSummary {
  const totalRevenue = calculateTotalRevenue(state.revenueSources);
  const totalAllocated = calculateTotalBudget(state.budgetAllocations);
  const budgetUtilization =
    state.structure.totalBudget > 0 ? (totalAllocated / state.structure.totalBudget) * 100 : 0;

  const isBalanced =
    Math.abs(totalRevenue - state.structure.totalBudget) <
    Math.max(1000, state.structure.totalBudget * 0.01);

  return {
    name: state.structure.governmentName || "Unnamed Government",
    type: state.structure.governmentType || "Unknown",
    fiscalYear: state.structure.fiscalYear || "Unknown",
    totalBudget: state.structure.totalBudget,
    currency: state.structure.budgetCurrency || "USD",
    departmentCount: state.departments.length,
    allocationCount: state.budgetAllocations.length,
    revenueSourceCount: state.revenueSources.length,
    totalRevenue,
    budgetUtilization,
    isBalanced,
  };
}
