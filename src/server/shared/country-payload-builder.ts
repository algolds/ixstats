import { z } from "zod";

/**
 * Shared Zod schema for economic inputs submitted through Country Builder / Editor.
 */
export const countryEconomicInputsSchema = z
  .object({
    coreIndicators: z
      .object({
        totalPopulation: z.number().min(0),
        gdpPerCapita: z.number().min(0),
        nominalGDP: z.number().min(0),
        realGDPGrowthRate: z.number().optional(),
        inflationRate: z.number().optional(),
        currencyExchangeRate: z.number().optional(),
      })
      .optional(),
    laborEmployment: z
      .object({
        laborForceParticipationRate: z.number().min(0).max(100),
        unemploymentRate: z.number().min(0).max(100),
        totalWorkforce: z.number().optional(),
        employmentRate: z.number().optional(),
        averageWorkweekHours: z.number().optional(),
        minimumWage: z.number().optional(),
        averageAnnualIncome: z.number().optional(),
      })
      .optional(),
    fiscalSystem: z
      .object({
        taxRevenueGDPPercent: z.number().optional(),
        governmentSpendingGDPPercent: z.number().optional(),
        governmentRevenueTotal: z.number().optional(),
        taxRevenuePerCapita: z.number().optional(),
        governmentBudgetGDPPercent: z.number().optional(),
        budgetDeficitSurplus: z.number().optional(),
        internalDebtGDPPercent: z.number().optional(),
        externalDebtGDPPercent: z.number().optional(),
        totalDebtGDPRatio: z.number().optional(),
        debtPerCapita: z.number().optional(),
        interestRates: z.number().optional(),
        debtServiceCosts: z.number().optional(),
        salesTaxRate: z.number().optional(),
      })
      .optional(),
    demographics: z
      .object({
        urbanPopulationPercent: z.number().min(0).max(100).optional(),
        lifeExpectancy: z.number().optional(),
        literacyRate: z.number().min(0).max(100).optional(),
        populationGrowthRate: z.number().optional(),
        urbanRuralSplit: z
          .object({
            urban: z.number(),
            rural: z.number(),
          })
          .optional(),
        ageDistribution: z.array(z.any()).optional(),
        educationLevels: z.array(z.any()).optional(),
      })
      .optional(),
    incomeWealth: z
      .object({
        giniIndex: z.number().min(0).max(100).optional(),
        povertyRate: z.number().optional(),
        incomeInequalityGini: z.number().optional(),
        socialMobilityIndex: z.number().optional(),
        economicClasses: z.array(z.any()).optional(),
      })
      .optional(),
    governmentSpending: z
      .object({
        totalSpending: z.number().optional(),
        spendingGDPPercent: z.number().optional(),
        spendingPerCapita: z.number().optional(),
        spendingCategories: z.array(z.any()).optional(),
      })
      .passthrough()
      .optional(),
    nationalIdentity: z
      .object({
        countryName: z.string().optional(),
        officialName: z.string().optional(),
        governmentType: z.string().optional(),
        motto: z.string().optional(),
        mottoNative: z.string().optional(),
        capitalCity: z.string().optional(),
        largestCity: z.string().optional(),
        demonym: z.string().optional(),
        nationalReligion: z.string().optional(),
        currency: z.string().optional(),
        currencySymbol: z.string().optional(),
        officialLanguages: z.string().optional(),
        nationalLanguage: z.string().optional(),
        nationalAnthem: z.string().optional(),
        nationalDay: z.string().optional(),
        nationalSport: z.string().optional(),
        nationalAnimal: z.string().optional(),
        nationalBird: z.string().optional(),
        nationalFish: z.string().optional(),
        founders: z.string().optional(),
        nationalFlower: z.string().optional(),
        nationalDish: z.string().optional(),
        nationalFruit: z.string().optional(),
        nationalDrink: z.string().optional(),
        nationalInstrument: z.string().optional(),
        nationalSymbol: z.string().optional(),
        nationalAnimalImage: z.string().optional(),
        nationalBirdImage: z.string().optional(),
        nationalFishImage: z.string().optional(),
        foundersImage: z.string().optional(),
        nationalFlowerImage: z.string().optional(),
        nationalDishImage: z.string().optional(),
        nationalFruitImage: z.string().optional(),
        nationalDrinkImage: z.string().optional(),
        nationalInstrumentImage: z.string().optional(),
        nationalSymbolImage: z.string().optional(),
        callingCode: z.string().optional(),
        internetTLD: z.string().optional(),
        drivingSide: z.string().optional(),
        timeZone: z.string().optional(),
        isoCode: z.string().optional(),
        coordinatesLatitude: z.string().optional(),
        coordinatesLongitude: z.string().optional(),
        emergencyNumber: z.string().optional(),
        postalCodeFormat: z.string().optional(),
        weekStartDay: z.string().optional(),
        leader: z.string().optional(),
      })
      .optional(),
    geography: z
      .object({
        continent: z.string().optional(),
        region: z.string().optional(),
      })
      .optional(),
    flagUrl: z.string().optional(),
    coatOfArmsUrl: z.string().optional(),
  })
  .optional();

export const countryGovernmentComponentSchema = z.object({
  componentType: z.string(),
  effectivenessScore: z.number().min(0).max(100).optional(),
  implementationCost: z.number().optional(),
  maintenanceCost: z.number().optional(),
  requiredCapacity: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});
