// src/hooks/useEconomyData.ts

import { useMemo } from "react"
import { api } from "~/trpc/react"
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
    api.countries.getByIdWithEconomicData.useQuery(
      { id: countryId },
      { staleTime: 60_000 }
    )

  const economy = useMemo<EconomyData | null>(() => {
    if (!data) return null

    return {
      core: {
        totalPopulation: data.baselinePopulation,
        nominalGDP: data.nominalGDP,
        gdpPerCapita: data.currentGdpPerCapita,
        realGDPGrowthRate: data.realGDPGrowthRate,
        inflationRate: data.inflationRate,
        currencyExchangeRate: data.currencyExchangeRate
      },
      labor: {
        laborForceParticipationRate: data.laborForceParticipationRate!,
        employmentRate: data.employmentRate!,
        unemploymentRate: data.unemploymentRate!,
        totalWorkforce: data.totalWorkforce!,
        averageWorkweekHours: data.averageWorkweekHours!,
        minimumWage: data.minimumWage!,
        averageAnnualIncome: data.averageAnnualIncome!,
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
        benefits: {
          unemploymentBenefitRate: 0,
          maxUnemploymentWeeks: 0,
          pensionContributionRate: 0,
          healthcareContributionRate: 0,
          socialSecurityCoverage: 0
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
        taxRevenueGDPPercent: data.taxRevenueGDPPercent ?? 20,
        governmentRevenueTotal: data.governmentRevenueTotal ?? (data.nominalGDP || 0) * 0.20,
        taxRevenuePerCapita: data.taxRevenuePerCapita ?? ((data.nominalGDP || 0) * 0.20) / data.baselinePopulation,
        governmentBudgetGDPPercent: data.governmentBudgetGDPPercent ?? 22,
        budgetDeficitSurplus: data.budgetDeficitSurplus ?? 0,
        internalDebtGDPPercent: data.internalDebtGDPPercent ?? 30,
        externalDebtGDPPercent: data.externalDebtGDPPercent ?? 20,
        totalDebtGDPRatio: data.totalDebtGDPRatio ?? 50,
        debtPerCapita: data.debtPerCapita ?? 0,
        interestRates: data.interestRates ?? 0.03,
        debtServiceCosts: data.debtServiceCosts ?? 0,
        taxRates: {
          personalIncomeTaxRates: (data.fiscalSystem)?.taxRates?.personalIncomeTaxRates || [
            { bracket: 50000, rate: 0.15 },
            { bracket: 100000, rate: 0.25 },
            { bracket: 200000, rate: 0.35 }
          ],
          corporateTaxRates: (data.fiscalSystem)?.taxRates?.corporateTaxRates || [
            { size: 'Small', rate: 0.15 },
            { size: 'Medium', rate: 0.25 },
            { size: 'Large', rate: 0.30 }
          ],
          salesTaxRate: (data.fiscalSystem)?.taxRates?.salesTaxRate || 0.08,
          propertyTaxRate: (data.fiscalSystem)?.taxRates?.propertyTaxRate || 0.012,
          payrollTaxRate: (data.fiscalSystem)?.taxRates?.payrollTaxRate || 0.062,
          exciseTaxRates: (data.fiscalSystem)?.taxRates?.exciseTaxRates || [
            { type: 'Alcohol', rate: 0.20 },
            { type: 'Tobacco', rate: 0.45 },
            { type: 'Fuel', rate: 0.18 }
          ],
          wealthTaxRate: (data.fiscalSystem)?.taxRates?.wealthTaxRate || 0.005
        },
        governmentSpendingByCategory: (data.governmentBudget && data.governmentBudget.spendingCategories 
          ? (typeof data.governmentBudget.spendingCategories === 'string' 
              ? JSON.parse(data.governmentBudget.spendingCategories)
              : data.governmentBudget.spendingCategories)
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
        economicClasses: (data.incomeDistribution && data.incomeDistribution.economicClasses)
          ? JSON.parse(data.incomeDistribution.economicClasses)
          : [],
        povertyRate: 15, // Default value since property doesn't exist
        incomeInequalityGini: 0.35, // Default value since property doesn't exist
        socialMobilityIndex: 50 // Default value since property doesn't exist
      },
      spending: {
        totalSpending: data.totalGovernmentSpending ?? (data.nominalGDP || 0) * 0.22,
        spendingGDPPercent: data.spendingGDPPercent ?? 22,
        spendingPerCapita: data.spendingPerCapita ?? ((data.nominalGDP || 0) * 0.22) / data.baselinePopulation,
        deficitSurplus: data.budgetDeficitSurplus ?? 0,
        spendingCategories: (data.governmentBudget && data.governmentBudget.spendingCategories
          ? (typeof data.governmentBudget.spendingCategories === 'string' 
              ? JSON.parse(data.governmentBudget.spendingCategories)
              : data.governmentBudget.spendingCategories)
          : undefined) || [
              { category: 'Healthcare', amount: 0, percent: 25, color: '#22c55e' },
              { category: 'Education', amount: 0, percent: 20, color: '#3b82f6' },
              { category: 'Defense', amount: 0, percent: 15, color: '#ef4444' },
              { category: 'Infrastructure', amount: 0, percent: 12, color: '#f59e0b' },
              { category: 'Social Welfare', amount: 0, percent: 18, color: '#8b5cf6' },
              { category: 'Other', amount: 0, percent: 10, color: '#6b7280' }
            ]
      },
      demographics: {
        lifeExpectancy: data.lifeExpectancy ?? 75,
        urbanPopulationPercent: data.urbanPopulationPercent ?? 70,
        ruralPopulationPercent: data.ruralPopulationPercent ?? 30,
        urbanRuralSplit: { 
          urban: data.urbanPopulationPercent ?? 70, 
          rural: data.ruralPopulationPercent ?? 30 
        },
        ageDistribution: (data.demographics)?.ageDistribution
          ? (typeof (data.demographics).ageDistribution === 'string' 
              ? JSON.parse((data.demographics).ageDistribution)
              : (data.demographics).ageDistribution)
          : [
              { group: "0-14", percent: 18, color: "#3b82f6" },
              { group: "15-64", percent: 68, color: "#22c55e" },
              { group: "65+", percent: 14, color: "#f59e0b" }
            ],
        regions: (data.demographics && data.demographics.regions)
          ? (typeof data.demographics.regions === 'string' 
              ? JSON.parse(data.demographics.regions)
              : data.demographics.regions as any)
          : [
              { name: "Capital Region", population: data.baselinePopulation * 0.3, urbanPercent: 95, color: "#3b82f6" },
              { name: "Northern Region", population: data.baselinePopulation * 0.25, urbanPercent: 60, color: "#22c55e" },
              { name: "Southern Region", population: data.baselinePopulation * 0.25, urbanPercent: 55, color: "#f59e0b" },
              { name: "Other Regions", population: data.baselinePopulation * 0.2, urbanPercent: 45, color: "#8b5cf6" }
            ],
        educationLevels: (data.demographics && data.demographics.educationLevels)
          ? (typeof data.demographics.educationLevels === 'string' 
              ? JSON.parse(data.demographics.educationLevels)
              : data.demographics.educationLevels as any)
          : [
              { level: "Primary", percent: 25, color: "#ef4444" },
              { level: "Secondary", percent: 45, color: "#f59e0b" },
              { level: "Tertiary", percent: 30, color: "#22c55e" }
            ],
        literacyRate: data.literacyRate ?? 90,
        citizenshipStatuses: (data.demographics && data.demographics.citizenshipStatuses)
          ? (typeof data.demographics.citizenshipStatuses === 'string' 
              ? JSON.parse(data.demographics.citizenshipStatuses)
              : data.demographics.citizenshipStatuses as any)
          : [
              { status: "Citizens", percent: 92, color: "#22c55e" },
              { status: "Permanent Residents", percent: 6, color: "#3b82f6" },
              { status: "Temporary Residents", percent: 2, color: "#f59e0b" }
            ]
      }
    }
  }, [data])

  return { economy, isLoading, error, refetch }
}