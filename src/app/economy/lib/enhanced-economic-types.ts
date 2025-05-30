// src/app/economy/lib/enhanced-economic-types.ts
// TypeScript interfaces

import type { ReactNode } from "react";

export interface TaxBracket {
    minIncome: number;
    maxIncome: number | null; // null for highest bracket
    rate: number;
  }
  
  export interface CorporateTaxTier {
    revenueThreshold: number;
    rate: number;
    description: string;
  }
  
  export interface ExciseTaxRates {
    alcohol: number;
    tobacco: number;
    fuel: number;
    luxuryGoods: number;
    environmentalTax: number;
  }
  
  export interface GovernmentSpending {
    defense: number;
    education: number;
    healthcare: number;
    infrastructure: number;
    socialServices: number;
    administration: number;
    diplomatic: number;
    justice: number;
  }
  
  export interface EnhancedEconomicInputs {
    // Base fields (existing)
    countryName: string;
    population: number;
    gdpPerCapita: number;
    taxRevenuePercent: number;
    unemploymentRate: number;
    governmentBudgetPercent: number;
    internalDebtPercent: number;
    externalDebtPercent: number;
  
    // Core Economic Indicators
    realGDPGrowthRate: number;
    inflationRate: number;
    currencyExchangeRate: number;
    baseCurrency: string;
  
    // Labor & Employment
    laborForceParticipationRate: number;
    employmentRate: number; // calculated from unemployment
    totalWorkforce: number; // calculated
    averageWorkweekHours: number;
    minimumWage: number;
    averageAnnualIncome: number;
  
    // Fiscal System - Revenue
    governmentRevenueTotal: number; // calculated
    taxRevenuePerCapita: number; // calculated
    
    // Tax Rates
    personalIncomeTaxRates: TaxBracket[];
    corporateTaxRates: CorporateTaxTier[];
    salesTaxRate: number;
    propertyTaxRate: number;
    payrollTaxRate: number;
    exciseTaxRates: ExciseTaxRates;
    wealthTaxRate: number;
  
    // Government Spending
    budgetDeficitSurplus: number; // calculated
    governmentSpendingBreakdown: GovernmentSpending;
  }
  
  export interface CountryComparison {
    metric: ReactNode;
    tier(tier: any): unknown;
    analysis: ReactNode;
    comparableCountries: any;
    countryName: string;
    similarity: number; // 0-100%
    matchingFields: string[];
    keyDifferences: Array<{
      field: string;
      userValue: number;
      countryValue: number;
      difference: number;
    }>;
  }
  
  export interface EconomicHint {
    type: 'suggestion' | 'warning' | 'info';
    title: string;
    message: string;
    relatedCountries: string[];
    impact: 'low' | 'medium' | 'high';
  }