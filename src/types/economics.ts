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
  
  // Labor & employment
  export interface LaborEmploymentData {
    laborForceParticipationRate: number  // percent
    employmentRate: number               // percent
    unemploymentRate: number             // percent
    totalWorkforce: number
    averageWorkweekHours: number
    minimumWage: number
    averageAnnualIncome: number
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
    // For detailed JSON-typed fields you can use `Record<string, unknown>`
    personalIncomeTaxRates?: any[]
    corporateTaxRates?: any[]
    exciseTaxRates?: any[]
    spendingByCategory?: { category: string; amount: number; percent: number }[]
  }
  
  // Income & wealth distribution
  export interface IncomeWealthDistributionData {
    economicClasses: Array<{
      name: string
      populationPercent: number
      wealthPercent: number
      averageIncome: number
      color?: string
    }>
    povertyRate: number        // percent
    incomeInequalityGini: number  // decimal
    socialMobilityIndex: number
  }
  
  // Government spending
  export interface GovernmentSpendingData {
    totalGovernmentSpending: number
    spendingGDPPercent: number
    spendingPerCapita: number
    budgetDeficitSurplus: number
    spendingCategories: Array<{
      category: string
      amount: number
      percent: number
      icon?: string
      color?: string
      description?: string
    }>
  }
  
  // Demographics
  export interface DemographicsData {
    lifeExpectancy: number
    urbanPopulationPercent: number
    ruralPopulationPercent: number
    ageDistribution: Array<{ group: string; percent: number; color?: string }>
    regions: Array<{ name: string; population: number; urbanPercent: number; color?: string }>
    educationLevels: Array<{ level: string; percent: number; color?: string }>
    literacyRate: number
    citizenshipStatuses: Array<{ status: string; percent: number; color?: string }>
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