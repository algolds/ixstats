/**
 * Policy Validation Utilities
 *
 * This module provides comprehensive validation functions for policy creation,
 * including step-by-step validation, impact calculations, and feasibility assessment.
 *
 * Features:
 * - Step-specific validation for multi-step policy creation wizard
 * - Cost and budget validation with warnings
 * - Impact calculation based on policy type and economic data
 * - Feasibility assessment considering country state
 *
 * @module policy-validation
 */

import { type PolicyType, type PolicyPriority } from "./policy-templates";

/**
 * Validation result interface
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Array of error messages */
  errors: string[];
}

/**
 * Validation result with warnings
 */
export interface ValidationResultWithWarnings extends ValidationResult {
  /** Array of warning messages (non-blocking) */
  warnings: string[];
}

/**
 * Policy impact calculation result
 */
export interface PolicyImpact {
  /** Projected GDP impact (percentage) */
  gdpImpact: number;
  /** Projected employment impact (percentage) */
  employmentImpact: number;
  /** Projected budget impact (currency units) */
  budgetImpact: number;
  /** Projected revenue impact (currency units) */
  revenueImpact?: number;
}

/**
 * Feasibility assessment result
 */
export interface FeasibilityAssessment {
  /** Whether policy is feasible */
  feasible: boolean;
  /** Feasibility score (0-100) */
  score: number;
  /** Contributing factors to feasibility */
  factors: string[];
}

/**
 * Economic data interface for impact calculations
 */
export interface EconomicData {
  structure: {
    totalGDP: number;
  };
  totalBudget?: number;
}

/**
 * Country data interface for feasibility assessment
 */
export interface CountryData {
  totalBudget?: number;
  gdp?: number;
  stability?: number;
  [key: string]: any;
}

/**
 * Complete policy data for final validation
 */
export interface PolicyData {
  name: string;
  description: string;
  policyType: PolicyType;
  implementationCost: number;
  maintenanceCost: number;
  priority: PolicyPriority;
  effectiveDate?: Date | null;
  expiryDate?: Date | null;
}

/**
 * Validate Step 1: Basic policy information
 *
 * @param policyType - Selected policy type
 * @param name - Policy name
 * @param description - Policy description
 * @returns Validation result with errors
 */
export function validatePolicyStep1(
  policyType: PolicyType | null | undefined,
  name: string,
  description: string
): ValidationResult {
  const errors: string[] = [];

  if (!policyType) {
    errors.push("Policy type is required");
  }

  if (!name || name.trim().length === 0) {
    errors.push("Policy name is required");
  } else if (name.trim().length < 3) {
    errors.push("Policy name must be at least 3 characters");
  }

  if (!description || description.trim().length === 0) {
    errors.push("Policy description is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Step 2: Department selection
 *
 * Department selection is optional, so this always returns valid.
 * Included for consistency and future extension.
 *
 * @param department - Selected department (optional)
 * @returns Validation result (always valid)
 */
export function validatePolicyStep2(department: string | null | undefined): ValidationResult {
  return {
    valid: true,
    errors: [],
  };
}

/**
 * Validate Step 3: Impact configuration (costs)
 *
 * @param implementationCost - Implementation cost
 * @param maintenanceCost - Annual maintenance cost
 * @returns Validation result with errors
 */
export function validatePolicyStep3(
  implementationCost: number,
  maintenanceCost: number
): ValidationResult {
  const errors: string[] = [];

  if (implementationCost <= 0) {
    errors.push("Implementation cost must be greater than 0");
  }

  if (maintenanceCost < 0) {
    errors.push("Maintenance cost cannot be negative");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Step 4: Timeline configuration
 *
 * @param effectiveDate - Policy effective date (optional)
 * @param expiryDate - Policy expiry date (optional)
 * @returns Validation result with errors
 */
export function validatePolicyStep4(
  effectiveDate: Date | null | undefined,
  expiryDate: Date | null | undefined
): ValidationResult {
  const errors: string[] = [];

  // If both dates are provided, expiry must be after effective
  if (effectiveDate && expiryDate) {
    if (expiryDate <= effectiveDate) {
      errors.push("Expiry date must be after effective date");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Step 5: Complete policy review
 *
 * Validates all required fields before final submission.
 *
 * @param policyData - Complete policy data
 * @returns Validation result with errors
 */
export function validatePolicyStep5(policyData: PolicyData): ValidationResult {
  const errors: string[] = [];

  // Validate basic info
  const step1Result = validatePolicyStep1(
    policyData.policyType,
    policyData.name,
    policyData.description
  );
  errors.push(...step1Result.errors);

  // Validate costs
  const step3Result = validatePolicyStep3(
    policyData.implementationCost,
    policyData.maintenanceCost
  );
  errors.push(...step3Result.errors);

  // Validate dates
  const step4Result = validatePolicyStep4(policyData.effectiveDate, policyData.expiryDate);
  errors.push(...step4Result.errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate policy name specifically
 *
 * @param name - Policy name to validate
 * @returns Validation result with single error if invalid
 */
export function validatePolicyName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Policy name is required" };
  }

  if (name.trim().length < 3) {
    return { valid: false, error: "Policy name must be at least 3 characters" };
  }

  if (name.length > 200) {
    return { valid: false, error: "Policy name must be less than 200 characters" };
  }

  return { valid: true };
}

/**
 * Validate policy costs with optional budget check
 *
 * @param implementationCost - Implementation cost
 * @param maintenanceCost - Annual maintenance cost
 * @param countryBudget - Available country budget (optional)
 * @returns Validation result with warnings
 */
export function validatePolicyCosts(
  implementationCost: number,
  maintenanceCost: number,
  countryBudget?: number
): ValidationResultWithWarnings {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (implementationCost <= 0) {
    errors.push("Implementation cost must be greater than 0");
  }

  if (maintenanceCost < 0) {
    errors.push("Maintenance cost cannot be negative");
  }

  // Budget warnings
  if (countryBudget !== undefined) {
    const totalCost = implementationCost + maintenanceCost;

    if (totalCost > countryBudget) {
      warnings.push(
        `Total cost exceeds available budget by $${((totalCost - countryBudget) / 1000000).toFixed(2)}M`
      );
    }

    if (implementationCost > countryBudget * 0.5) {
      warnings.push("Implementation cost exceeds 50% of total budget");
    }

    if (maintenanceCost > countryBudget * 0.1) {
      warnings.push("Maintenance cost exceeds 10% of annual budget");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate policy impact on economy
 *
 * Estimates the economic impact of a policy based on its type, costs,
 * and the current economic state.
 *
 * @param policy - Policy data
 * @param economicData - Current economic data
 * @returns Projected policy impact
 */
export function calculatePolicyImpact(
  policy: Pick<PolicyData, "policyType" | "implementationCost" | "maintenanceCost">,
  economicData: EconomicData
): PolicyImpact {
  const gdp = economicData.structure.totalGDP;
  const { policyType, implementationCost, maintenanceCost } = policy;

  let gdpImpact = 0;
  let employmentImpact = 0;
  let revenueImpact = 0;

  // Calculate based on policy type
  switch (policyType) {
    case "economic":
      // Economic policies have high GDP multiplier
      gdpImpact = (implementationCost / gdp) * 100 * 0.5;
      employmentImpact = (implementationCost / 100000) * 0.01;
      revenueImpact = gdpImpact * 0.3;
      break;

    case "social":
      // Social policies focus on employment
      employmentImpact = (implementationCost / 150000) * 0.01;
      gdpImpact = employmentImpact * 0.5;
      revenueImpact = -maintenanceCost;
      break;

    case "infrastructure":
      // Infrastructure has highest GDP multiplier
      gdpImpact = (implementationCost / gdp) * 100 * 0.8;
      employmentImpact = (implementationCost / 80000) * 0.01;
      revenueImpact = gdpImpact * 0.2;
      break;

    case "diplomatic":
      // Diplomatic policies affect trade
      gdpImpact = (implementationCost / gdp) * 100 * 0.3;
      employmentImpact = (implementationCost / 200000) * 0.01;
      revenueImpact = gdpImpact * 0.25;
      break;

    case "governance":
      // Governance policies improve efficiency
      gdpImpact = (implementationCost / gdp) * 100 * 0.2;
      employmentImpact = (implementationCost / 250000) * 0.01;
      revenueImpact = -maintenanceCost;
      break;
  }

  const budgetImpact = -(implementationCost + maintenanceCost);

  return {
    gdpImpact: Math.round(gdpImpact * 100) / 100,
    employmentImpact: Math.round(employmentImpact * 100) / 100,
    budgetImpact: Math.round(budgetImpact),
    revenueImpact: Math.round(revenueImpact),
  };
}

/**
 * Assess policy feasibility
 *
 * Evaluates whether a policy is feasible given the current country state,
 * considering budget constraints, economic capacity, and stability.
 *
 * @param policy - Policy data
 * @param countryData - Current country data
 * @returns Feasibility assessment
 */
export function assessPolicyFeasibility(
  policy: Pick<PolicyData, "implementationCost" | "maintenanceCost" | "priority">,
  countryData: CountryData
): FeasibilityAssessment {
  const factors: string[] = [];
  let score = 100;

  const { implementationCost, maintenanceCost, priority } = policy;
  const totalCost = implementationCost + maintenanceCost;

  // Budget constraint assessment
  if (countryData.totalBudget !== undefined) {
    const budgetRatio = totalCost / countryData.totalBudget;

    if (budgetRatio > 1.0) {
      score -= 40;
      factors.push("Insufficient budget available");
    } else if (budgetRatio > 0.5) {
      score -= 20;
      factors.push("High budget commitment required");
    } else {
      factors.push("Budget constraints manageable");
    }
  }

  // Economic capacity assessment
  if (countryData.gdp !== undefined) {
    const gdpRatio = implementationCost / countryData.gdp;

    if (gdpRatio > 0.1) {
      score -= 15;
      factors.push("Large economic impact relative to GDP");
    } else {
      factors.push("Economically sustainable");
    }
  }

  // Stability assessment
  if (countryData.stability !== undefined) {
    if (countryData.stability < 50 && priority === "critical") {
      score -= 10;
      factors.push("Low stability may hinder critical policy implementation");
    } else if (countryData.stability > 70) {
      score += 10;
      factors.push("High stability supports implementation");
    }
  }

  // Priority adjustment
  if (priority === "critical") {
    score += 5;
    factors.push("Critical priority increases commitment");
  }

  const feasible = score >= 50;

  return {
    feasible,
    score: Math.max(0, Math.min(100, score)),
    factors,
  };
}
