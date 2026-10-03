/**
 * Tax System Types
 * Comprehensive type definitions for the tax management system
 */

import { z } from "zod";

const TaxSystemInputSchema = z.object({
  taxSystemName: z.string().min(1, "Tax system name is required"),
  taxAuthority: z.string().optional(),
  fiscalYear: z.string().min(1, "Fiscal year is required"),
  taxCode: z.string().optional(),
  baseRate: z.number().min(0).max(100).optional(),
  progressiveTax: z.boolean(),
  flatTaxRate: z.number().min(0).max(100).optional(),
  alternativeMinTax: z.boolean(),
  alternativeMinRate: z.number().min(0).max(100).optional(),
  complianceRate: z.number().min(0).max(100).optional(),
  collectionEfficiency: z.number().min(0).max(100).optional(),
});

const TaxCategoryInputSchema = z.object({
  categoryName: z.string().min(1, "Category name is required"),
  categoryType: z.string().min(1, "Category type is required"),
  description: z.string().optional(),
  isActive: z.boolean(),
  baseRate: z.number().min(0).max(100).optional(),
  calculationMethod: z.enum(["percentage", "fixed", "tiered", "progressive"]),
  minimumAmount: z.number().nonnegative().optional(),
  maximumAmount: z.number().nonnegative().optional(),
  exemptionAmount: z.number().nonnegative().optional(),
  deductionAllowed: z.boolean(),
  standardDeduction: z.number().nonnegative().optional(),
  priority: z.number().int().min(1).max(100),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const TaxBracketInputSchema = z.object({
  bracketName: z.string().optional(),
  minIncome: z.number().nonnegative(),
  maxIncome: z.number().nonnegative().optional(),
  rate: z.number().min(0).max(100),
  flatAmount: z.number().nonnegative().optional(),
  marginalRate: z.boolean(),
  isActive: z.boolean(),
  priority: z.number().int().min(1),
});

const TaxExemptionInputSchema = z.object({
  categoryId: z.string().optional(),
  exemptionName: z.string().min(1),
  exemptionType: z.string().min(1),
  description: z.string().optional(),
  exemptionAmount: z.number().nonnegative().optional(),
  exemptionRate: z.number().min(0).max(100).optional(),
  qualifications: z.any().optional(),
  isActive: z.boolean().default(true),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

const TaxDeductionInputSchema = z.object({
  deductionName: z.string().min(1),
  deductionType: z.string().min(1),
  description: z.string().optional(),
  maximumAmount: z.number().nonnegative().optional(),
  percentage: z.number().min(0).max(100).optional(),
  qualifications: z.any().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).optional(),
});

export const TaxBuilderStateSchema = z.object({
  taxSystem: TaxSystemInputSchema,
  categories: z.array(TaxCategoryInputSchema),
  brackets: z.record(z.string(), z.array(TaxBracketInputSchema)),
  exemptions: z.array(TaxExemptionInputSchema),
  deductions: z.record(z.string(), z.array(TaxDeductionInputSchema)),
  selectedAtomicTaxComponents: z.array(z.string()).optional(),
});
// Base enums and constants
export const CALCULATION_METHODS = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
  TIERED: "tiered",
  PROGRESSIVE: "progressive",
} as const;
// Core tax system types
export interface TaxSystem {
  id: string;
  countryId: string;
  taxSystemName: string;
  taxAuthority?: string;
  fiscalYear: string;
  taxCode?: string;
  baseRate?: number;
  progressiveTax: boolean;
  flatTaxRate?: number;
  alternativeMinTax: boolean;
  alternativeMinRate?: number;
  taxHolidays?: string; // JSON string
  complianceRate?: number;
  collectionEfficiency?: number;
  lastReform?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  taxCategories?: TaxCategory[];
  taxBrackets?: TaxBracket[];
  taxPolicy?: TaxPolicy[];
  taxExemptions?: TaxExemption[];
  taxCalculations?: TaxCalculation[];
}

interface TaxCategory {
  id: string;
  taxSystemId: string;
  categoryName: string;
  categoryType: string;
  description?: string;
  isActive: boolean;
  baseRate?: number;
  rate?: number;
  calculationMethod: string;
  minimumAmount?: number;
  maximumAmount?: number;
  exemptionAmount?: number;
  deductionAllowed: boolean;
  standardDeduction?: number;
  priority: number;
  color?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  taxBrackets?: TaxBracket[];
  taxExemptions?: TaxExemption[];
  taxDeductions?: TaxDeduction[];
}

interface TaxBracket {
  id: string;
  taxSystemId: string;
  categoryId: string;
  bracketName?: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  flatAmount?: number;
  marginalRate: boolean;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaxExemption {
  id: string;
  taxSystemId: string;
  categoryId?: string;
  exemptionName: string;
  exemptionType: string;
  description?: string;
  exemptionAmount?: number;
  exemptionRate?: number;
  qualifications?: string; // JSON string
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TaxDeduction {
  id: string;
  categoryId: string;
  deductionName: string;
  deductionType: string;
  description?: string;
  maximumAmount?: number;
  percentage?: number;
  qualifications?: string; // JSON string
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaxPolicy {
  id: string;
  taxSystemId: string;
  policyName: string;
  policyType: string;
  description?: string;
  targetCategory?: string;
  impactType: string;
  rateChange?: number;
  effectiveDate: Date;
  expiryDate?: Date;
  isActive: boolean;
  estimatedRevenue?: number;
  affectedPopulation?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaxCalculation {
  id: string;
  taxSystemId: string;
  calculationName: string;
  taxableIncome: number;
  totalDeductions: number;
  totalExemptions: number;
  adjustedGrossIncome: number;
  taxOwed: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown?: string; // JSON string
  calculationDate: Date;
  taxYear: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Input types for forms
export interface TaxSystemInput {
  taxSystemName: string;
  taxAuthority?: string;
  fiscalYear: string;
  taxCode?: string;
  baseRate?: number;
  progressiveTax: boolean;
  flatTaxRate?: number;
  alternativeMinTax: boolean;
  alternativeMinRate?: number;
  complianceRate?: number;
  collectionEfficiency?: number;
}

export type CalculationMethodValue = (typeof CALCULATION_METHODS)[keyof typeof CALCULATION_METHODS];

export interface TaxCategoryInput {
  categoryName: string;
  categoryType: string;
  description?: string;
  isActive: boolean;
  baseRate?: number;
  calculationMethod: CalculationMethodValue;
  minimumAmount?: number;
  maximumAmount?: number;
  exemptionAmount?: number;
  deductionAllowed: boolean;
  standardDeduction?: number;
  priority: number;
  color?: string;
  icon?: string;
}

export interface TaxBracketInput {
  bracketName?: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  flatAmount?: number;
  marginalRate: boolean;
  isActive: boolean;
  priority: number;
}

export interface TaxExemptionInput {
  categoryId?: string;
  exemptionName: string;
  exemptionType: string;
  description?: string;
  exemptionAmount?: number;
  exemptionRate?: number;
  qualifications?: any; // Will be stringified to JSON
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface TaxDeductionInput {
  deductionName: string;
  deductionType: string;
  description?: string;
  maximumAmount?: number;
  percentage?: number;
  qualifications?: any; // Will be stringified to JSON
  isActive: boolean;
  priority: number;
}

// Calculator types
// Templates and presets
export interface TaxSystemTemplate {
  name: string;
  description: string;
  fiscalYear: string;
  progressiveTax: boolean;
  categories: TaxCategoryTemplate[];
}

export interface TaxCategoryTemplate {
  categoryName: string;
  categoryType: string;
  description: string;
  baseRate: number;
  calculationMethod: CalculationMethodValue;
  brackets?: TaxBracketTemplate[];
  exemptions?: TaxExemptionTemplate[];
  deductions?: TaxDeductionTemplate[];
}

interface TaxBracketTemplate {
  bracketName?: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  marginalRate: boolean;
}

interface TaxExemptionTemplate {
  exemptionName: string;
  exemptionType: string;
  description: string;
  exemptionAmount?: number;
  exemptionRate?: number;
}

interface TaxDeductionTemplate {
  deductionName: string;
  deductionType: string;
  description: string;
  maximumAmount?: number;
  percentage?: number;
}

// Validation types
// Analytics and reporting types
