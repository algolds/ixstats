// src/hooks/useEconomyData.ts

import { useMemo } from "react"
import { api } from "~/trpc/react"
import { useAtomicState } from "~/components/atomic/AtomicStateProvider"
import type {
  EconomyData,
  CoreEconomicIndicatorsData,
  LaborEmploymentData,
  FiscalSystemData,
  IncomeWealthDistributionData,
  GovernmentSpendingData,
  DemographicsData
} from "../types/economics"

export function useEconomyData(countryId: string) {
  const { data, isLoading, error, refetch } =
    api.countries.getByIdAtTime.useQuery(
      { id: countryId },
      { staleTime: 60_000 }
    )

  // Try to get atomic state for enhanced calculations
  let atomicState = null;
  try {
    atomicState = useAtomicState();
  } catch {
    // AtomicStateProvider not available, use traditional calculations
    atomicState = null;
  }

  const economy = useMemo<EconomyData | null>(() => {
    if (!data) return null
    
    // Type assertion to access country properties
    const countryData = data as any;

    // Get atomic modifiers if available
    const atomicModifiers = atomicState?.state?.economicModifiers;
    const atomicTaxEffectiveness = atomicState?.state?.taxEffectiveness;

    // Apply atomic modifiers to base economic data
    const baseGdpGrowthRate = countryData.adjustedGdpGrowth || countryData.maxGdpGrowthRate || 0.03;
    const baseGdp = countryData.currentTotalGdp || countryData.nominalGDP || 0;
    const baseTaxRevenuePercent = countryData.taxRevenueGDPPercent ?? 20;
    
    // Enhanced GDP calculations with atomic government effectiveness
    const enhancedGdpGrowthRate = atomicModifiers 
      ? baseGdpGrowthRate * atomicModifiers.gdpGrowthModifier
      : baseGdpGrowthRate;
    
    const enhancedGdp = atomicModifiers
      ? baseGdp * (1 + (atomicModifiers.gdpGrowthModifier - 1) * 0.5) // Apply partial multiplier effect
      : baseGdp;
    
    // Enhanced tax collection with atomic effectiveness
    const enhancedTaxRevenuePercent = atomicTaxEffectiveness
      ? baseTaxRevenuePercent * atomicTaxEffectiveness.overallMultiplier
      : baseTaxRevenuePercent;

    const economyData: EconomyData = {
      core: {
        totalPopulation: countryData.currentPopulation || countryData.baselinePopulation || 0,
        nominalGDP: enhancedGdp,
        gdpPerCapita: countryData.currentGdpPerCapita || countryData.baselineGdpPerCapita || 0,
        realGDPGrowthRate: enhancedGdpGrowthRate,
        inflationRate: countryData.inflationRate || 0.02,
        currencyExchangeRate: countryData.currencyExchangeRate || 1.0
      },
      labor: {
        laborForceParticipationRate: 65.0,
        employmentRate: 95.0,
        unemploymentRate: countryData.unemploymentRate || 5.0,
        totalWorkforce: Math.floor((countryData.currentPopulation || countryData.baselinePopulation || 0) * 0.65),
        averageWorkweekHours: 40,
        minimumWage: Math.floor((countryData.currentGdpPerCapita || countryData.baselineGdpPerCapita || 0) / 52 / 40),
        averageAnnualIncome: countryData.currentGdpPerCapita || countryData.baselineGdpPerCapita || 0,
        employmentBySector: {
          agriculture: 0,
          industry: 0,
          services: 0
        },
        employmentByType: {
          fullTime: 0,
          partTime: 0,
          temporary: 0,
          selfEmployed: 0,
          informal: 0
        },
        skillsAndProductivity: {
          averageEducationYears: 0,
          tertiaryEducationRate: 0,
          vocationalTrainingRate: 0,
          skillsGapIndex: 0,
          laborProductivityIndex: 100,
          productivityGrowthRate: 0
        },
        demographicsAndConditions: {
          youthUnemploymentRate: 0,
          femaleParticipationRate: 0,
          genderPayGap: 0,
          unionizationRate: 0,
          workplaceSafetyIndex: 0,
          averageCommutingTime: 0
        },
        regionalEmployment: {
          urban: {
            participationRate: 0,
            unemploymentRate: 0,
            averageIncome: 0
          },
          rural: {
            participationRate: 0,
            unemploymentRate: 0,
            averageIncome: 0
          }
        },
        socialProtection: {
          unemploymentBenefitCoverage: 60, // Default value
          pensionCoverage: 70, // Default value
          healthInsuranceCoverage: 80, // Default value
          paidSickLeaveDays: 8, // Default value
          paidVacationDays: 15, // Default value
          parentalLeaveWeeks: 12 // Default value
        }
      },
      fiscal: {
        taxRevenueGDPPercent: enhancedTaxRevenuePercent,
        governmentRevenueTotal: countryData.governmentRevenueTotal ?? enhancedGdp * (enhancedTaxRevenuePercent / 100),
        taxRevenuePerCapita: countryData.taxRevenuePerCapita ?? (enhancedGdp * (enhancedTaxRevenuePercent / 100)) / (countryData.currentPopulation || countryData.baselinePopulation || 1),
        governmentBudgetGDPPercent: countryData.governmentBudgetGDPPercent ?? 22,
        budgetDeficitSurplus: countryData.budgetDeficitSurplus ?? 0,
        internalDebtGDPPercent: countryData.internalDebtGDPPercent ?? 30,
        externalDebtGDPPercent: countryData.externalDebtGDPPercent ?? 20,
        totalDebtGDPRatio: countryData.totalDebtGDPRatio ?? 50,
        debtPerCapita: countryData.debtPerCapita ?? 0,
        interestRates: countryData.interestRates ?? 0.03,
        debtServiceCosts: countryData.debtServiceCosts ?? 0,
        taxRates: {
          personalIncomeTaxRates: Array.isArray((countryData.fiscalSystem)?.taxRates?.personalIncomeTaxRates) 
            ? (countryData.fiscalSystem)?.taxRates?.personalIncomeTaxRates
            : [
                { bracket: 50000, rate: 0.15 },
                { bracket: 100000, rate: 0.25 },
                { bracket: 200000, rate: 0.35 }
              ],
          corporateTaxRates: Array.isArray((countryData.fiscalSystem)?.taxRates?.corporateTaxRates) 
            ? (countryData.fiscalSystem)?.taxRates?.corporateTaxRates
            : [
                { size: 'Small', rate: 0.15 },
                { size: 'Medium', rate: 0.25 },
                { size: 'Large', rate: 0.30 }
              ],
          salesTaxRate: (countryData.fiscalSystem)?.taxRates?.salesTaxRate || 0.08,
          propertyTaxRate: (countryData.fiscalSystem)?.taxRates?.propertyTaxRate || 0.012,
          payrollTaxRate: (countryData.fiscalSystem)?.taxRates?.payrollTaxRate || 0.062,
          exciseTaxRates: (countryData.fiscalSystem)?.taxRates?.exciseTaxRates || [
            { type: 'Alcohol', rate: 0.20 },
            { type: 'Tobacco', rate: 0.45 },
            { type: 'Fuel', rate: 0.18 }
          ],
          wealthTaxRate: (countryData.fiscalSystem)?.taxRates?.wealthTaxRate || 0.005
        },
        governmentSpendingByCategory: (countryData.governmentBudget && countryData.governmentBudget.spendingCategories 
          ? (typeof countryData.governmentBudget.spendingCategories === 'string' 
              ? JSON.parse(countryData.governmentBudget.spendingCategories)
              : countryData.governmentBudget.spendingCategories)
          : undefined) || [
          { category: 'Healthcare', amount: 0, percent: 25 },
          { category: 'Education', amount: 0, percent: 20 },
          { category: 'Defense', amount: 0, percent: 15 },
          { category: 'Infrastructure', amount: 0, percent: 12 },
          { category: 'Social Welfare', amount: 0, percent: 18 },
          { category: 'Other', amount: 0, percent: 10 }
        ]
      },
      income: {
        economicClasses: (countryData.incomeDistribution && countryData.incomeDistribution.economicClasses)
          ? (typeof countryData.incomeDistribution.economicClasses === 'string' 
              ? JSON.parse(countryData.incomeDistribution.economicClasses)
              : countryData.incomeDistribution.economicClasses)
          : [],
        povertyRate: 15, // Default value since property doesn't exist
        incomeInequalityGini: 0.35, // Default value since property doesn't exist
        socialMobilityIndex: 50 // Default value since property doesn't exist
      },
      spending: {
        education: 20, // Default percentage
        healthcare: 25, // Default percentage
        socialSafety: 18, // Default percentage
        totalSpending: countryData.totalGovernmentSpending ?? (countryData.currentTotalGdp || countryData.nominalGDP || 0) * 0.22,
        spendingGDPPercent: countryData.spendingGDPPercent ?? 22,
        spendingPerCapita: countryData.spendingPerCapita ?? ((countryData.currentTotalGdp || countryData.nominalGDP || 0) * 0.22) / (countryData.currentPopulation || countryData.baselinePopulation || 1),
        deficitSurplus: countryData.budgetDeficitSurplus ?? 0,
        spendingCategories: (countryData.governmentBudget && countryData.governmentBudget.spendingCategories
          ? (typeof countryData.governmentBudget.spendingCategories === 'string' 
              ? JSON.parse(countryData.governmentBudget.spendingCategories)
              : countryData.governmentBudget.spendingCategories)
          : undefined) || [
              { category: 'Healthcare', amount: 0, percent: 25, color: '#22c55e' },
              { category: 'Education', amount: 0, percent: 20, color: '#3b82f6' },
              { category: 'Defense', amount: 0, percent: 15, color: '#ef4444' },
              { category: 'Infrastructure', amount: 0, percent: 12, color: '#f59e0b' },
              { category: 'Social Welfare', amount: 0, percent: 18, color: '#8b5cf6' },
              { category: 'Other', amount: 0, percent: 10, color: '#6b7280' }
            ],
        performanceBasedBudgeting: false,
        universalBasicServices: false,
        greenInvestmentPriority: false,
        digitalGovernmentInitiative: false
      },
      demographics: {
        lifeExpectancy: countryData.lifeExpectancy ?? 75,
        urbanRuralSplit: { 
          urban: countryData.urbanPopulationPercent ?? 70, 
          rural: countryData.ruralPopulationPercent ?? 30 
        },
        ageDistribution: (countryData.demographics)?.ageDistribution
          ? (typeof (countryData.demographics).ageDistribution === 'string' 
              ? JSON.parse((countryData.demographics).ageDistribution)
              : (countryData.demographics).ageDistribution)
          : [
              { group: "0-14", percent: 18, color: "#3b82f6" },
              { group: "15-64", percent: 68, color: "#22c55e" },
              { group: "65+", percent: 14, color: "#f59e0b" }
            ],
        regions: (countryData.demographics && countryData.demographics.regions)
          ? (typeof countryData.demographics.regions === 'string' 
              ? JSON.parse(countryData.demographics.regions)
              : countryData.demographics.regions as any)
          : [
              { name: "Capital Region", population: (countryData.currentPopulation || countryData.baselinePopulation || 0) * 0.3, urbanPercent: 95, color: "#3b82f6" },
              { name: "Northern Region", population: (countryData.currentPopulation || countryData.baselinePopulation || 0) * 0.25, urbanPercent: 60, color: "#22c55e" },
              { name: "Southern Region", population: (countryData.currentPopulation || countryData.baselinePopulation || 0) * 0.25, urbanPercent: 55, color: "#f59e0b" },
              { name: "Other Regions", population: (countryData.currentPopulation || countryData.baselinePopulation || 0) * 0.2, urbanPercent: 45, color: "#8b5cf6" }
            ],
        educationLevels: (countryData.demographics && countryData.demographics.educationLevels)
          ? (typeof countryData.demographics.educationLevels === 'string' 
              ? JSON.parse(countryData.demographics.educationLevels)
              : countryData.demographics.educationLevels as any)
          : [
              { level: "Primary", percent: 25, color: "#ef4444" },
              { level: "Secondary", percent: 45, color: "#f59e0b" },
              { level: "Tertiary", percent: 30, color: "#22c55e" }
            ],
        literacyRate: countryData.literacyRate ?? 90,
        citizenshipStatuses: (countryData.demographics && countryData.demographics.citizenshipStatuses)
          ? (typeof countryData.demographics.citizenshipStatuses === 'string' 
              ? JSON.parse(countryData.demographics.citizenshipStatuses)
              : countryData.demographics.citizenshipStatuses as any)
          : [
              { status: "Citizens", percent: 92, color: "#22c55e" },
              { status: "Permanent Residents", percent: 6, color: "#3b82f6" },
              { status: "Temporary Residents", percent: 2, color: "#f59e0b" }
            ]
      }
    };
    
    return economyData;
  }, [data, atomicState])

  return { economy, isLoading, error, refetch }
}