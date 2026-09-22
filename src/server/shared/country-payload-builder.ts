import { z } from "zod";

/**
 * Robust JSON primitive and recursive value types for structured payloads.
 * Zero "any" or "unknown" types adhering to strict codebase quality constraints.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const jsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonLiteralSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

export const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

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
      .passthrough()
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
      .passthrough()
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
      .passthrough()
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
          .passthrough()
          .optional(),
        ageDistribution: z
          .array(
            z
              .object({
                group: z.string().optional(),
                percent: z.number().optional(),
                percentage: z.number().optional(),
                color: z.string().optional(),
              })
              .passthrough()
          )
          .optional(),
        educationLevels: z
          .array(
            z
              .object({
                level: z.string().optional(),
                percent: z.number().optional(),
                percentage: z.number().optional(),
                color: z.string().optional(),
              })
              .passthrough()
          )
          .optional(),
        regions: z.array(jsonRecordSchema).optional(),
      })
      .passthrough()
      .optional(),
    incomeWealth: z
      .object({
        giniIndex: z.number().min(0).max(100).optional(),
        povertyRate: z.number().optional(),
        incomeInequalityGini: z.number().optional(),
        socialMobilityIndex: z.number().optional(),
        economicClasses: z
          .array(
            z
              .object({
                class: z.string().optional(),
                name: z.string().optional(),
                percent: z.number().optional(),
                percentage: z.number().optional(),
                income: z.number().optional(),
              })
              .passthrough()
          )
          .optional(),
      })
      .passthrough()
      .optional(),
    governmentSpending: z
      .object({
        totalSpending: z.number().optional(),
        spendingGDPPercent: z.number().optional(),
        spendingPerCapita: z.number().optional(),
        spendingCategories: z
          .array(
            z
              .object({
                name: z.string().optional(),
                amount: z.number().optional(),
                percent: z.number().optional(),
              })
              .passthrough()
          )
          .optional(),
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
      .passthrough()
      .optional(),
    geography: z
      .object({
        continent: z.string().optional(),
        region: z.string().optional(),
      })
      .passthrough()
      .optional(),
    flagUrl: z.string().optional(),
    coatOfArmsUrl: z.string().optional(),
  })
  .passthrough()
  .optional();

export const countryGovernmentComponentSchema = z
  .object({
    componentType: z.string(),
    effectivenessScore: z.number().min(0).max(100).optional(),
    implementationCost: z.number().optional(),
    maintenanceCost: z.number().optional(),
    requiredCapacity: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export const countryTaxBracketInputSchema = z
  .object({
    bracketName: z.string().optional(),
    minIncome: z.number().nullable().optional(),
    maxIncome: z.number().nullable().optional(),
    rate: z.number().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const countryTaxCategoryInputSchema = z
  .object({
    categoryName: z.string().optional(),
    categoryType: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    baseRate: z.number().optional(),
    calculationMethod: z.string().optional(),
    minimumAmount: z.number().optional(),
    maximumAmount: z.number().optional(),
    exemptionAmount: z.number().optional(),
    deductionAllowed: z.boolean().optional(),
    standardDeduction: z.number().optional(),
    priority: z.number().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    brackets: z.array(countryTaxBracketInputSchema).optional(),
  })
  .passthrough();

export const countryTaxSystemInputSchema = z
  .object({
    taxSystemName: z.string().optional(),
    taxAuthority: z.string().optional(),
    fiscalYear: z.string().optional(),
    taxCode: z.string().optional(),
    baseRate: z.number().optional(),
    progressiveTax: z.boolean().optional(),
    totalTaxRate: z.number().optional(),
    flatTaxRate: z.number().optional(),
    alternativeMinTax: z.boolean().optional(),
    alternativeMinRate: z.number().optional(),
    taxHolidays: z.string().optional(),
    complianceRate: z.number().optional(),
    collectionEfficiency: z.number().optional(),
    lastReform: z.string().optional(),
    taxSystem: jsonValueSchema.optional(),
    categories: jsonValueSchema.optional(),
    brackets: jsonValueSchema.optional(),
    exemptions: jsonValueSchema.optional(),
    deductions: jsonValueSchema.optional(),
    selectedAtomicTaxComponents: z.array(z.string()).optional(),
    isValid: z.boolean().optional(),
    errors: jsonValueSchema.optional(),
  })
  .passthrough();

export const countryGovernmentStructureInputSchema = z
  .object({
    governmentName: z.string().optional(),
    governmentType: z.string().optional(),
    headOfState: z.string().optional(),
    headOfGovernment: z.string().optional(),
    legislatureName: z.string().optional(),
    executiveName: z.string().optional(),
    judicialName: z.string().optional(),
    totalBudget: z.number().optional(),
    fiscalYear: z.string().optional(),
    budgetCurrency: z.string().optional(),
    structure: jsonValueSchema.optional(),
    departments: jsonValueSchema.optional(),
    budgetAllocations: jsonValueSchema.optional(),
    revenueSources: jsonValueSchema.optional(),
    selectedComponents: z.array(z.string()).optional(),
    isValid: z.boolean().optional(),
    errors: jsonValueSchema.optional(),
  })
  .passthrough();

export const countryEconomyBuilderStateSchema = z
  .object({
    selectedAtomicComponents: z.array(z.string()).optional(),
    sectors: jsonValueSchema.optional(),
    structure: jsonValueSchema.optional(),
    laborMarket: jsonValueSchema.optional(),
    demographics: jsonValueSchema.optional(),
    tradeSystem: jsonValueSchema.optional(),
    errors: jsonValueSchema.optional(),
    validation: jsonValueSchema.optional(),
    isValid: z.boolean().optional(),
    version: z.string().optional(),
  })
  .passthrough();

