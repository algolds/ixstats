/**
 * Tax Calculator Engine
 * Real-time tax calculations with support for progressive, flat, and tiered systems
 */

import type {
  TaxSystem,
  TaxCategory,
  TaxBracket,
  TaxExemption,
  TaxDeduction,
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxCategoryBreakdown,
  AppliedTaxBracket,
  TaxDeductionAmount,
  TaxExemptionAmount
} from '~/types/tax-system';

export class TaxCalculatorEngine {
  private taxSystem: TaxSystem;
  private categories: TaxCategory[];
  private brackets: TaxBracket[];
  private exemptions: TaxExemption[];
  private deductions: TaxDeduction[];

  constructor(
    taxSystem: TaxSystem,
    categories: TaxCategory[],
    brackets: TaxBracket[],
    exemptions: TaxExemption[],
    deductions: TaxDeduction[]
  ) {
    this.taxSystem = taxSystem;
    this.categories = categories.filter(c => c.isActive);
    this.brackets = brackets.filter(b => b.isActive);
    this.exemptions = exemptions.filter(e => e.isActive);
    this.deductions = deductions.filter(d => d.isActive);
  }

  /**
   * Main calculation method
   */
  calculate(request: TaxCalculationRequest): TaxCalculationResult {
    const { income, deductions = [], exemptions = [] } = request;
    
    // Calculate total exemptions
    const totalExemptions = this.calculateTotalExemptions(income, exemptions);
    
    // Calculate total deductions
    const totalDeductions = this.calculateTotalDeductions(income, deductions);
    
    // Calculate adjusted gross income
    const adjustedGrossIncome = Math.max(0, income - totalExemptions);
    const taxableIncome = Math.max(0, adjustedGrossIncome - totalDeductions);
    
    // Calculate tax by category
    const categoryBreakdowns: TaxCategoryBreakdown[] = [];
    const appliedBrackets: AppliedTaxBracket[] = [];
    let totalTaxOwed = 0;
    
    for (const category of this.categories) {
      const categoryResult = this.calculateCategoryTax(
        category, 
        taxableIncome, 
        adjustedGrossIncome,
        income
      );
      
      categoryBreakdowns.push(categoryResult.breakdown);
      appliedBrackets.push(...categoryResult.appliedBrackets);
      totalTaxOwed += categoryResult.taxOwed;
    }
    
    // Apply Alternative Minimum Tax if enabled
    if (this.taxSystem.alternativeMinTax && this.taxSystem.alternativeMinRate) {
      const amtTax = (adjustedGrossIncome * this.taxSystem.alternativeMinRate) / 100;
      if (amtTax > totalTaxOwed) {
        totalTaxOwed = amtTax;
      }
    }
    
    // Calculate effective and marginal rates
    const effectiveRate = income > 0 ? (totalTaxOwed / income) * 100 : 0;
    const marginalRate = this.calculateMarginalRate(taxableIncome);
    
    return {
      taxableIncome,
      totalDeductions,
      totalExemptions,
      adjustedGrossIncome,
      taxOwed: Math.max(0, totalTaxOwed),
      effectiveRate,
      marginalRate,
      breakdown: categoryBreakdowns,
      appliedBrackets
    };
  }

  /**
   * Calculate tax for a specific category
   */
  private calculateCategoryTax(
    category: TaxCategory,
    taxableIncome: number,
    adjustedGrossIncome: number,
    grossIncome: number
  ): {
    breakdown: TaxCategoryBreakdown;
    appliedBrackets: AppliedTaxBracket[];
    taxOwed: number;
  } {
    let categoryTaxableAmount = taxableIncome;
    let categoryTaxOwed = 0;
    const appliedBrackets: AppliedTaxBracket[] = [];
    
    // Apply category-specific minimums and maximums
    if (category.minimumAmount && categoryTaxableAmount < category.minimumAmount) {
      categoryTaxableAmount = 0;
    }
    
    if (category.maximumAmount && categoryTaxableAmount > category.maximumAmount) {
      categoryTaxableAmount = category.maximumAmount;
    }
    
    // Apply category-specific exemptions
    let categoryExemptions = 0;
    if (category.exemptionAmount) {
      categoryExemptions = category.exemptionAmount;
      categoryTaxableAmount = Math.max(0, categoryTaxableAmount - categoryExemptions);
    }
    
    // Apply category-specific deductions
    let categoryDeductions = 0;
    if (category.deductionAllowed && category.standardDeduction) {
      categoryDeductions = category.standardDeduction;
      categoryTaxableAmount = Math.max(0, categoryTaxableAmount - categoryDeductions);
    }
    
    // Calculate tax based on calculation method
    switch (category.calculationMethod) {
      case 'percentage':
        categoryTaxOwed = this.calculatePercentageTax(category, categoryTaxableAmount);
        break;
        
      case 'fixed':
        categoryTaxOwed = category.baseRate || 0;
        break;
        
      case 'tiered':
      case 'progressive':
        const progressiveResult = this.calculateProgressiveTax(category, categoryTaxableAmount);
        categoryTaxOwed = progressiveResult.taxOwed;
        appliedBrackets.push(...progressiveResult.appliedBrackets);
        break;
        
      default:
        categoryTaxOwed = this.calculatePercentageTax(category, categoryTaxableAmount);
    }
    
    const breakdown: TaxCategoryBreakdown = {
      categoryId: category.id,
      categoryName: category.categoryName,
      taxableAmount: categoryTaxableAmount,
      taxOwed: Math.max(0, categoryTaxOwed),
      rate: category.baseRate || 0,
      exemptions: categoryExemptions,
      deductions: categoryDeductions
    };
    
    return {
      breakdown,
      appliedBrackets,
      taxOwed: Math.max(0, categoryTaxOwed)
    };
  }

  /**
   * Calculate percentage-based tax
   */
  private calculatePercentageTax(category: TaxCategory, taxableAmount: number): number {
    const rate = (category.baseRate || 0) / 100;
    return taxableAmount * rate;
  }

  /**
   * Calculate progressive/tiered tax using brackets
   */
  private calculateProgressiveTax(
    category: TaxCategory,
    taxableAmount: number
  ): {
    taxOwed: number;
    appliedBrackets: AppliedTaxBracket[];
  } {
    const categoryBrackets = this.brackets
      .filter(b => b.categoryId === category.id)
      .sort((a, b) => a.minIncome - b.minIncome);
    
    if (categoryBrackets.length === 0) {
      // Fallback to base rate if no brackets defined
      return {
        taxOwed: this.calculatePercentageTax(category, taxableAmount),
        appliedBrackets: []
      };
    }
    
    let totalTax = 0;
    let remainingIncome = taxableAmount;
    const appliedBrackets: AppliedTaxBracket[] = [];
    
    for (const bracket of categoryBrackets) {
      if (remainingIncome <= 0) break;
      
      const bracketMin = bracket.minIncome;
      const bracketMax = bracket.maxIncome || Infinity;
      
      if (taxableAmount <= bracketMin) continue;
      
      const taxableInThisBracket = Math.min(
        remainingIncome,
        bracketMax - bracketMin,
        taxableAmount - bracketMin
      );
      
      if (taxableInThisBracket > 0) {
        const bracketTax = bracket.flatAmount || 
          (taxableInThisBracket * bracket.rate / 100);
        
        totalTax += bracketTax;
        remainingIncome -= taxableInThisBracket;
        
        appliedBrackets.push({
          bracketId: bracket.id,
          bracketName: bracket.bracketName,
          minIncome: bracketMin,
          maxIncome: bracket.maxIncome,
          rate: bracket.rate,
          taxableAmount: taxableInThisBracket,
          taxOwed: bracketTax
        });
      }
    }
    
    return {
      taxOwed: totalTax,
      appliedBrackets
    };
  }

  /**
   * Calculate total exemptions
   */
  private calculateTotalExemptions(
    income: number,
    requestedExemptions: TaxExemptionAmount[]
  ): number {
    let totalExemptions = 0;
    
    // System-wide exemptions
    const systemExemptions = this.exemptions.filter(e => !e.categoryId);
    for (const exemption of systemExemptions) {
      if (exemption.exemptionAmount) {
        totalExemptions += exemption.exemptionAmount;
      } else if (exemption.exemptionRate) {
        totalExemptions += (income * exemption.exemptionRate) / 100;
      }
    }
    
    // Requested exemptions
    for (const requested of requestedExemptions) {
      const exemption = this.exemptions.find(e => e.id === requested.exemptionId);
      if (exemption) {
        totalExemptions += requested.amount;
      }
    }
    
    return totalExemptions;
  }

  /**
   * Calculate total deductions
   */
  private calculateTotalDeductions(
    income: number,
    requestedDeductions: TaxDeductionAmount[]
  ): number {
    let totalDeductions = 0;
    
    // Standard deductions from categories
    for (const category of this.categories) {
      if (category.deductionAllowed && category.standardDeduction) {
        totalDeductions += category.standardDeduction;
      }
    }
    
    // Requested deductions
    for (const requested of requestedDeductions) {
      const deduction = this.deductions.find(d => d.id === requested.deductionId);
      if (deduction) {
        let deductionAmount = requested.amount;
        
        // Apply maximum limits
        if (deduction.maximumAmount) {
          deductionAmount = Math.min(deductionAmount, deduction.maximumAmount);
        }
        
        // Apply percentage limits
        if (deduction.percentage) {
          const percentageLimit = (income * deduction.percentage) / 100;
          deductionAmount = Math.min(deductionAmount, percentageLimit);
        }
        
        totalDeductions += deductionAmount;
      }
    }
    
    return totalDeductions;
  }

  /**
   * Calculate marginal tax rate
   */
  private calculateMarginalRate(taxableIncome: number): number {
    let highestRate = 0;
    
    for (const category of this.categories) {
      const categoryBrackets = this.brackets
        .filter(b => b.categoryId === category.id)
        .sort((a, b) => b.minIncome - a.minIncome); // Sort descending
      
      for (const bracket of categoryBrackets) {
        if (taxableIncome >= bracket.minIncome) {
          highestRate = Math.max(highestRate, bracket.rate);
          break;
        }
      }
      
      // Fallback to base rate if no brackets apply
      if (categoryBrackets.length === 0 && category.baseRate) {
        highestRate = Math.max(highestRate, category.baseRate);
      }
    }
    
    return highestRate;
  }

  /**
   * Validate tax calculation inputs
   */
  validateCalculationRequest(request: TaxCalculationRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation
    if (!request.income || request.income < 0) {
      errors.push('Income must be a positive number');
    }
    
    if (request.taxYear < 1900 || request.taxYear > new Date().getFullYear() + 10) {
      errors.push('Tax year must be valid');
    }
    
    // Check for missing tax categories
    if (this.categories.length === 0) {
      warnings.push('No active tax categories found');
    }
    
    // Check for missing brackets in progressive categories
    for (const category of this.categories) {
      if (category.calculationMethod === 'progressive') {
        const brackets = this.brackets.filter(b => b.categoryId === category.id);
        if (brackets.length === 0) {
          warnings.push(`Progressive tax category "${category.categoryName}" has no brackets defined`);
        }
      }
    }
    
    // Validate requested deductions
    for (const deduction of request.deductions || []) {
      const deductionDef = this.deductions.find(d => d.id === deduction.deductionId);
      if (!deductionDef) {
        errors.push(`Invalid deduction ID: ${deduction.deductionId}`);
      } else if (deduction.amount < 0) {
        errors.push(`Deduction amount must be positive for ${deductionDef.deductionName}`);
      }
    }
    
    // Validate requested exemptions
    for (const exemption of request.exemptions || []) {
      const exemptionDef = this.exemptions.find(e => e.id === exemption.exemptionId);
      if (!exemptionDef) {
        errors.push(`Invalid exemption ID: ${exemption.exemptionId}`);
      } else if (exemption.amount < 0) {
        errors.push(`Exemption amount must be positive for ${exemptionDef.exemptionName}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate tax optimization suggestions
   */
  generateOptimizationSuggestions(
    request: TaxCalculationRequest,
    result: TaxCalculationResult
  ): string[] {
    const suggestions: string[] = [];
    
    // High effective rate warning
    if (result.effectiveRate > 30) {
      suggestions.push('Consider tax planning strategies to reduce effective rate');
    }
    
    // Unused deductions
    const availableDeductions = this.deductions.filter(d => 
      !request.deductions?.find(rd => rd.deductionId === d.id)
    );
    
    if (availableDeductions.length > 0) {
      suggestions.push(`Consider claiming ${availableDeductions.length} available deductions`);
    }
    
    // Unused exemptions
    const availableExemptions = this.exemptions.filter(e => 
      !request.exemptions?.find(re => re.exemptionId === e.id)
    );
    
    if (availableExemptions.length > 0) {
      suggestions.push(`Consider claiming ${availableExemptions.length} available exemptions`);
    }
    
    // AMT impact
    if (this.taxSystem.alternativeMinTax && this.taxSystem.alternativeMinRate) {
      const amtTax = (result.adjustedGrossIncome * this.taxSystem.alternativeMinRate) / 100;
      if (amtTax > result.taxOwed * 0.9) {
        suggestions.push('Alternative Minimum Tax may apply - consider AMT planning');
      }
    }
    
    return suggestions;
  }
}