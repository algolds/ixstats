/**
 * Tax System Types
 * Comprehensive type definitions for the tax management system
 */

// Base enums and constants
export const TAX_CATEGORIES = {
  INCOME: 'Personal Income Tax',
  CORPORATE: 'Corporate Income Tax',
  SALES: 'Sales Tax / VAT',
  PROPERTY: 'Property Tax',
  CAPITAL_GAINS: 'Capital Gains Tax',
  ESTATE: 'Estate Tax',
  GIFT: 'Gift Tax',
  CUSTOMS: 'Customs Duties',
  EXCISE: 'Excise Tax',
  PAYROLL: 'Payroll Tax',
  OTHER: 'Other Tax'
} as const;

export const TAX_TYPES = {
  DIRECT: 'Direct Tax',
  INDIRECT: 'Indirect Tax'
} as const;

export const CALCULATION_METHODS = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
  TIERED: 'tiered',
  PROGRESSIVE: 'progressive'
} as const;

export const EXEMPTION_TYPES = {
  INDIVIDUAL: 'Individual',
  CORPORATE: 'Corporate',
  SECTOR: 'Sector',
  GEOGRAPHIC: 'Geographic',
  INCOME_BASED: 'Income Based'
} as const;

export const DEDUCTION_TYPES = {
  STANDARD: 'Standard',
  ITEMIZED: 'Itemized',
  ABOVE_THE_LINE: 'Above the Line',
  BELOW_THE_LINE: 'Below the Line'
} as const;

export const FISCAL_YEARS = {
  CALENDAR: 'calendar',
  APRIL_MARCH: 'april-march',
  JULY_JUNE: 'july-june',
  OCTOBER_SEPTEMBER: 'october-september'
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

export interface TaxCategory {
  id: string;
  taxSystemId: string;
  categoryName: string;
  categoryType: string;
  description?: string;
  isActive: boolean;
  baseRate?: number;
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

export interface TaxBracket {
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

export interface TaxExemption {
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

export interface TaxDeduction {
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

export interface TaxPolicy {
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

export interface TaxCalculation {
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

export interface TaxCategoryInput {
  categoryName: string;
  categoryType: string;
  description?: string;
  isActive: boolean;
  baseRate?: number;
  calculationMethod: string;
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
export interface TaxCalculationRequest {
  taxSystemId: string;
  taxYear: number;
  income: number;
  deductions?: TaxDeductionAmount[];
  exemptions?: TaxExemptionAmount[];
  specialCircumstances?: any;
}

export interface TaxDeductionAmount {
  deductionId: string;
  amount: number;
  description?: string;
}

export interface TaxExemptionAmount {
  exemptionId: string;
  amount: number;
  description?: string;
}

export interface TaxCalculationResult {
  taxableIncome: number;
  totalDeductions: number;
  totalExemptions: number;
  adjustedGrossIncome: number;
  taxOwed: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown: TaxCategoryBreakdown[];
  appliedBrackets: AppliedTaxBracket[];
}

export interface TaxCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  taxableAmount: number;
  taxOwed: number;
  rate: number;
  exemptions: number;
  deductions: number;
}

export interface AppliedTaxBracket {
  bracketId: string;
  bracketName?: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  taxableAmount: number;
  taxOwed: number;
}

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
  calculationMethod: string;
  brackets?: TaxBracketTemplate[];
  exemptions?: TaxExemptionTemplate[];
  deductions?: TaxDeductionTemplate[];
}

export interface TaxBracketTemplate {
  bracketName?: string;
  minIncome: number;
  maxIncome?: number;
  rate: number;
  marginalRate: boolean;
}

export interface TaxExemptionTemplate {
  exemptionName: string;
  exemptionType: string;
  description: string;
  exemptionAmount?: number;
  exemptionRate?: number;
}

export interface TaxDeductionTemplate {
  deductionName: string;
  deductionType: string;
  description: string;
  maximumAmount?: number;
  percentage?: number;
}

// Validation types
export interface TaxSystemValidation {
  isValid: boolean;
  errors: TaxValidationError[];
  warnings: TaxValidationWarning[];
}

export interface TaxValidationError {
  field: string;
  message: string;
  code: string;
}

export interface TaxValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'low' | 'medium' | 'high';
}

// Analytics and reporting types
export interface TaxRevenueProjection {
  category: string;
  currentRevenue: number;
  projectedRevenue: number;
  growthRate: number;
  confidence: number;
}

export interface TaxAnalytics {
  totalRevenue: number;
  revenueByCategory: Record<string, number>;
  effectiveRates: Record<string, number>;
  complianceRates: Record<string, number>;
  projections: TaxRevenueProjection[];
  trends: TaxTrend[];
}

export interface TaxTrend {
  period: string;
  category: string;
  value: number;
  change: number;
  changePercent: number;
}

export type TaxCategoryType = keyof typeof TAX_CATEGORIES;
export type TaxTypeEnum = keyof typeof TAX_TYPES;
export type CalculationMethod = keyof typeof CALCULATION_METHODS;
export type ExemptionType = keyof typeof EXEMPTION_TYPES;
export type DeductionType = keyof typeof DEDUCTION_TYPES;
export type FiscalYear = keyof typeof FISCAL_YEARS;