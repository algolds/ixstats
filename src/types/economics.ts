// src/types/economics.ts

// Core economic indicators
export interface CoreEconomicIndicatorsData {
    totalPopulation: number
    nominalGDP: number
    gdpPerCapita: number
    realGDPGrowthRate: number  // decimal (e.g. 0.03)
    inflationRate: number      // decimal
    currencyExchangeRate: number
  }
  
  // Labor & employment - Enhanced with detailed metrics
  export interface LaborEmploymentData {
    // Basic metrics
    laborForceParticipationRate: number  // percent
    employmentRate: number               // percent
    unemploymentRate: number             // percent
    totalWorkforce: number
    averageWorkweekHours: number
    minimumWage: number
    averageAnnualIncome: number
    
    // Employment by sector
    employmentBySector: {
      agriculture: number        // percent of workforce
      industry: number          // percent of workforce  
      services: number          // percent of workforce
    }
    
    // Employment by type
    employmentByType: {
      fullTime: number          // percent of workforce
      partTime: number          // percent of workforce
      temporary: number         // percent of workforce
      selfEmployed: number      // percent of workforce
      informal: number          // percent of workforce
    }
    
    // Skills and productivity
    skillsAndProductivity: {
      averageEducationYears: number
      tertiaryEducationRate: number      // percent
      vocationalTrainingRate: number     // percent
      skillsGapIndex: number             // 0-100 scale
      laborProductivityIndex: number     // base 100
      productivityGrowthRate: number     // percent annual
    }
    
    // Demographics and conditions
    demographicsAndConditions: {
      youthUnemploymentRate: number      // ages 15-24, percent
      femaleParticipationRate: number    // percent
      genderPayGap: number              // percent
      unionizationRate: number          // percent
      workplaceSafetyIndex: number      // 0-100 scale
      averageCommutingTime: number      // minutes
    }
    
    // Regional breakdown
    regionalEmployment: {
      urban: {
        participationRate: number       // percent
        unemploymentRate: number        // percent
        averageIncome: number
      }
      rural: {
        participationRate: number       // percent
        unemploymentRate: number        // percent
        averageIncome: number
      }
    }
    
    // Benefits and social protection
    socialProtection: {
      unemploymentBenefitCoverage: number  // percent of unemployed
      pensionCoverage: number             // percent of workforce
      healthInsuranceCoverage: number     // percent of workforce
      paidSickLeaveDays: number           // average days per year
      paidVacationDays: number            // average days per year
      parentalLeaveWeeks: number          // weeks
    }
  }
  
  // Fiscal system
  export interface FiscalSystemData {
    taxRevenueGDPPercent: number
    governmentRevenueTotal: number
    taxRevenuePerCapita: number
    governmentBudgetGDPPercent: number
    budgetDeficitSurplus: number
    internalDebtGDPPercent: number
    externalDebtGDPPercent: number
    totalDebtGDPRatio: number
    debtPerCapita: number
    interestRates: number               // decimal
    debtServiceCosts: number
    taxRates: {
      personalIncomeTaxRates: Array<{ bracket: number; rate: number }>
      corporateTaxRates: Array<{ size: string; rate: number }>
      salesTaxRate: number
      propertyTaxRate: number
      payrollTaxRate: number
      exciseTaxRates: Array<{ type: string; rate: number }>
      wealthTaxRate: number
    }
    governmentSpendingByCategory: Array<{
      category: string
      amount: number
      percent: number
      icon?: string
      color?: string
      description?: string
    }>
  }
  
  // Income & wealth distribution
  export interface IncomeWealthDistributionData {
    economicClasses: Array<{
      name: string
      populationPercent: number
      wealthPercent: number
      averageIncome: number
      color: string
    }>
    povertyRate: number        // percent
    incomeInequalityGini: number  // decimal
    socialMobilityIndex: number
  }
  
  // Government spending
  export interface GovernmentSpendingData {
    education: number
    totalSpending: number
    spendingGDPPercent: number
    spendingPerCapita: number
    deficitSurplus: number
    spendingCategories: Array<{
      category: string
      amount: number
      percent: number
      icon?: string
      color?: string
      description?: string
    }>
  performanceBasedBudgeting: boolean;
  universalBasicServices: boolean;
  greenInvestmentPriority: boolean;
  digitalGovernmentInitiative: boolean;
  }
  
  // Demographics
  export interface DemographicsData {
    lifeExpectancy: number
    urbanRuralSplit: { urban: number; rural: number }
    ageDistribution: Array<{ group: string; percent: number; color?: string }>
    regions: Array<{ name: string; population: number; urbanPercent: number; color?: string }>
    educationLevels: Array<{ level: string; percent: number; color?: string }>
    literacyRate: number
    citizenshipStatuses: Array<{ status: string; percent: number; color?: string }>
  }
  
  // Spending Category type
  export interface SpendingCategory {
    category: string
    amount: number
    percent: number
    icon?: string
    color?: string
    description?: string
  }
  
  // Aggregate
  export interface EconomyData {
    core: CoreEconomicIndicatorsData
    labor: LaborEmploymentData
    fiscal: FiscalSystemData
    income: IncomeWealthDistributionData
    spending: GovernmentSpendingData
    demographics: DemographicsData
  }