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
        nominalGDP: data.nominalGDP!,
        gdpPerCapita: data.currentGdpPerCapita,
        realGDPGrowthRate: data.realGDPGrowthRate!,
        inflationRate: data.inflationRate!,
        currencyExchangeRate: data.currencyExchangeRate!
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
        }
      },
      fiscal: {
        taxRevenueGDPPercent: data.taxRevenueGDPPercent!,
        governmentRevenueTotal: data.governmentRevenueTotal!,
        taxRevenuePerCapita: data.taxRevenuePerCapita!,
        governmentBudgetGDPPercent: data.governmentBudgetGDPPercent!,
        budgetDeficitSurplus: data.budgetDeficitSurplus!,
        internalDebtGDPPercent: data.internalDebtGDPPercent!,
        externalDebtGDPPercent: data.externalDebtGDPPercent!,
        totalDebtGDPRatio: data.totalDebtGDPRatio!,
        debtPerCapita: data.debtPerCapita!,
        interestRates: data.interestRates!,
        debtServiceCosts: data.debtServiceCosts!,
        personalIncomeTaxRates: data.fiscalSystem?.personalIncomeTaxRates,
        corporateTaxRates: data.fiscalSystem?.corporateTaxRates,
        exciseTaxRates: data.fiscalSystem?.exciseTaxRates,
        spendingByCategory: data.governmentBudget?.spendingCategories
      },
      income: {
        economicClasses: data.incomeDistribution
          ? JSON.parse(data.incomeDistribution.economicClasses as string)
          : [],
        povertyRate: data.povertyRate!,
        incomeInequalityGini: data.incomeInequalityGini!,
        socialMobilityIndex: data.socialMobilityIndex!
      },
      spending: {
        totalGovernmentSpending: data.totalGovernmentSpending!,
        spendingGDPPercent: data.spendingGDPPercent!,
        spendingPerCapita: data.spendingPerCapita!,
        budgetDeficitSurplus: data.budgetDeficitSurplus!,
        spendingCategories: data.governmentBudget
          ? JSON.parse(
              data.governmentBudget.spendingCategories as string
            )
          : []
      },
      demographics: {
        lifeExpectancy: data.lifeExpectancy!,
        urbanPopulationPercent: data.urbanPopulationPercent!,
        ruralPopulationPercent: data.ruralPopulationPercent!,
        ageDistribution: data.demographics
          ? JSON.parse(data.demographics.ageDistribution as string)
          : [],
        regions: data.demographics
          ? JSON.parse(data.demographics.regions as string)
          : [],
        educationLevels: data.demographics
          ? JSON.parse(data.demographics.educationLevels as string)
          : [],
        literacyRate: data.literacyRate!,
        citizenshipStatuses: data.demographics
          ? JSON.parse(data.demographics.citizenshipStatuses as string)
          : []
      }
    }
  }, [data])

  return { economy, isLoading, error, refetch }
}