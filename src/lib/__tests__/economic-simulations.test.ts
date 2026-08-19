import { IxStatsCalculator, EconomicTier, PopulationTier } from "~/lib/economy/calculations";
import { IxTime } from "~/lib/ixtime";
import { EconomicCalculationGroups } from "~/lib/economy/calculation-groups";
import {
  calculateModelHealth,
  validateModelParameters,
  calculateGdpProjections,
} from "~/lib/economy/modeling-engine";
import type { BaseCountryData, CountryStats, EconomicConfig } from "~/types/ixstats";
import type { EconomyData } from "~/types/economics";

// Mock Config alignment with 7-tier classifications
const mockConfig: EconomicConfig = {
  globalGrowthFactor: 1.0321,
  baseInflationRate: 0.02,
  economicTierThresholds: {
    impoverished: 0,
    developing: 10000,
    developed: 25000,
    healthy: 35000,
    strong: 45000,
    veryStrong: 55000,
    extravagant: 65000,
  },
  populationTierThresholds: {
    tier1: 0,
    tier2: 10000000,
    tier3: 30000000,
    tier4: 50000000,
    tier5: 80000000,
    tier6: 120000000,
    tier7: 350000000,
    tierX: 500000000,
  },
  tierGrowthModifiers: {
    [EconomicTier.IMPOVERISHED]: 1.0,
    [EconomicTier.DEVELOPING]: 1.0,
    [EconomicTier.DEVELOPED]: 1.0,
    [EconomicTier.HEALTHY]: 1.0,
    [EconomicTier.STRONG]: 1.0,
    [EconomicTier.VERY_STRONG]: 1.0,
    [EconomicTier.EXTRAVAGANT]: 1.0,
  },
  calculationIntervalMs: 86400000,
  ixTimeUpdateFrequency: 1.0,
  diminishingReturnsThreshold: 60000,
  diminishingReturnsFactor: 0.5,
  minGrowthFloor: -0.1,
};

const mockBaseCountry: BaseCountryData = {
  country: "TestLand",
  continent: "TestContinent",
  region: "TestRegion",
  governmentType: "Democracy",
  religion: "Secular",
  leader: "Leader X",
  population: 20000000,
  gdpPerCapita: 30000,
  landArea: 100000,
  areaSqMi: 38610,
  maxGdpGrowthRate: 0.05,
  adjustedGdpGrowth: 0.03,
  populationGrowthRate: 0.01,
  actualGdpGrowth: 0.025,
  projected2040Population: 25000000,
  projected2040Gdp: 900000000000,
  projected2040GdpPerCapita: 36000,
  localGrowthFactor: 1.0,
};

const mockEconomyData: EconomyData = {
  core: {
    totalPopulation: 20000000,
    nominalGDP: 600000000000,
    gdpPerCapita: 30000,
    realGDPGrowthRate: 0.03,
    inflationRate: 0.02,
    currencyExchangeRate: 1.0,
    giniCoefficient: 35,
  },
  labor: {
    laborForceParticipationRate: 65,
    employmentRate: 95,
    unemploymentRate: 5,
    totalWorkforce: 13000000,
    averageWorkweekHours: 40,
    minimumWage: 12.5,
    averageAnnualIncome: 35000,
    employmentBySector: {
      agriculture: 5,
      industry: 25,
      services: 70,
    },
    employmentByType: {
      fullTime: 70,
      partTime: 15,
      temporary: 5,
      selfEmployed: 8,
      informal: 2,
    },
    skillsAndProductivity: {
      averageEducationYears: 12,
      tertiaryEducationRate: 35,
      vocationalTrainingRate: 20,
      skillsGapIndex: 30,
      laborProductivityIndex: 100,
      productivityGrowthRate: 1.5,
    },
    demographicsAndConditions: {
      youthUnemploymentRate: 11,
      femaleParticipationRate: 58,
      genderPayGap: 15,
      unionizationRate: 15,
      workplaceSafetyIndex: 80,
      averageCommutingTime: 30,
    },
    regionalEmployment: {
      urban: { participationRate: 68, unemploymentRate: 4.5, averageIncome: 40000 },
      rural: { participationRate: 60, unemploymentRate: 6.0, averageIncome: 28000 },
    },
    socialProtection: {
      unemploymentBenefitCoverage: 80,
      pensionCoverage: 85,
      healthInsuranceCoverage: 90,
      paidSickLeaveDays: 10,
      paidVacationDays: 20,
      parentalLeaveWeeks: 12,
    },
  },
  fiscal: {
    taxRevenueGDPPercent: 25,
    governmentRevenueTotal: 150000000000,
    taxRevenuePerCapita: 7500,
    governmentBudgetGDPPercent: 27,
    budgetDeficitSurplus: -12000000000,
    internalDebtGDPPercent: 40,
    externalDebtGDPPercent: 20,
    totalDebtGDPRatio: 60,
    debtPerCapita: 18000,
    interestRates: 0.035,
    debtServiceCosts: 6300000000,
    taxRates: {
      personalIncomeTaxRates: [{ bracket: 50000, rate: 0.15 }],
      corporateTaxRates: [{ size: "Standard", rate: 0.21 }],
      salesTaxRate: 0.08,
      propertyTaxRate: 0.015,
      payrollTaxRate: 0.06,
      exciseTaxRates: [{ type: "Fuel", rate: 0.3 }],
      wealthTaxRate: 0,
    },
    governmentSpendingByCategory: [
      { category: "Education", amount: 30000000000, percent: 20 },
      { category: "Healthcare", amount: 40000000000, percent: 26.7 },
      { category: "Infrastructure", amount: 20000000000, percent: 13.3 },
    ],
  },
  income: {
    economicClasses: [
      {
        name: "Upper Class",
        populationPercent: 10,
        wealthPercent: 40,
        averageIncome: 120000,
        color: "blue",
      },
      {
        name: "Middle Class",
        populationPercent: 60,
        wealthPercent: 50,
        averageIncome: 45000,
        color: "green",
      },
      {
        name: "Lower Class",
        populationPercent: 30,
        wealthPercent: 10,
        averageIncome: 18000,
        color: "red",
      },
    ],
    povertyRate: 12,
    incomeInequalityGini: 0.35,
    socialMobilityIndex: 65,
  },
  spending: {
    education: 5.0,
    healthcare: 6.5,
    socialSafety: 4.5,
    totalSpending: 162000000000,
    spendingGDPPercent: 27,
    spendingPerCapita: 8100,
    deficitSurplus: -12000000000,
    spendingCategories: [
      { category: "Education", amount: 30000000000, percent: 20 },
      { category: "Healthcare", amount: 40000000000, percent: 26.7 },
      { category: "Infrastructure", amount: 20000000000, percent: 13.3 },
    ],
    performanceBasedBudgeting: true,
    universalBasicServices: false,
    greenInvestmentPriority: false,
    digitalGovernmentInitiative: true,
    zeroBasedBudgeting: false,
    publicPrivatePartnerships: true,
    participatoryBudgeting: false,
    emergencyReserveFund: true,
    socialImpactBonds: false,
    childWelfareFirstPolicy: true,
    preventiveCareEmphasis: true,
    infrastructureBankFund: true,
    universalBasicIncome: false,
    progressiveTaxation: true,
    carbonTax: false,
    wealthTax: false,
    financialTransactionTax: false,
    universalHealthcare: true,
    freeEducation: true,
    affordableHousing: true,
    elderlyCare: true,
    disabilitySupport: true,
    mentalHealthServices: true,
    stemEducationFocus: true,
    vocationalTraining: true,
    adultEducation: false,
    earlyChildhoodEducation: true,
    smartCityInitiative: false,
    publicTransportExpansion: true,
    renewableEnergyTransition: false,
    highSpeedInternet: true,
    waterInfrastructure: true,
    researchDevelopmentFund: true,
    startupIncubators: true,
    patentReform: false,
    openDataInitiative: true,
    cybersecurityInitiative: true,
    borderSecurity: true,
    disasterPreparedness: true,
    crimePrevention: true,
    carbonNeutrality: false,
    biodiversityProtection: false,
    wasteReduction: false,
    greenBuildingStandards: false,
    sustainableAgriculture: true,
    criminalJusticeReform: false,
    legalAidExpansion: false,
    restorativeJustice: false,
    courtSystemModernization: true,
    artsCultureFunding: true,
    heritagePreservation: true,
    multiculturalPrograms: false,
    languagePreservation: false,
    ruralDevelopment: true,
    ruralHealthcare: true,
    ruralBroadband: true,
    agriculturalSupport: true,
    foreignAidProgram: false,
    refugeeSupport: false,
    diplomaticEngagement: true,
    tradePromotion: true,
    transparencyInitiative: true,
    citizenEngagement: true,
    antiCorruption: true,
    publicServiceReform: true,
  },
  demographics: {
    lifeExpectancy: 78,
    urbanRuralSplit: { urban: 70, rural: 30 },
    ageDistribution: [
      { group: "0-14", percent: 20, color: "blue" },
      { group: "15-64", percent: 65, color: "green" },
      { group: "65+", percent: 15, color: "red" },
    ],
    regions: [
      { name: "Region A", population: 14000000, urbanPercent: 80, color: "blue" },
      { name: "Region B", population: 6000000, urbanPercent: 45, color: "green" },
    ],
    educationLevels: [
      { level: "Primary", percent: 10 },
      { level: "Secondary", percent: 55 },
      { level: "Tertiary", percent: 35 },
    ],
    literacyRate: 98,
    citizenshipStatuses: [
      { status: "Citizen", percent: 92 },
      { status: "Permanent Resident", percent: 6 },
      { status: "Temporary Resident", percent: 2 },
    ],
  },
};

describe("Active Economic Simulation Engine (calculations.ts)", () => {
  let calculator: IxStatsCalculator;

  beforeEach(() => {
    calculator = new IxStatsCalculator(mockConfig, Date.now());
  });

  describe("initializeCountryStats", () => {
    it("should correctly compute GDP per capita tier (7-tier classification)", () => {
      const stats = calculator.initializeCountryStats(mockBaseCountry);
      expect(stats.economicTier).toBe(EconomicTier.DEVELOPED); // 30k range

      const impoverishedStats = calculator.initializeCountryStats({
        ...mockBaseCountry,
        gdpPerCapita: 8000,
      });
      expect(impoverishedStats.economicTier).toBe(EconomicTier.IMPOVERISHED);

      const extravagantStats = calculator.initializeCountryStats({
        ...mockBaseCountry,
        gdpPerCapita: 80000,
      });
      expect(extravagantStats.economicTier).toBe(EconomicTier.EXTRAVAGANT);
    });

    it("should correctly compute population tier", () => {
      const stats = calculator.initializeCountryStats(mockBaseCountry);
      expect(stats.populationTier).toBe(PopulationTier.TIER_2); // 20M range
    });

    it("should validate and clamp extreme growth rate inputs", () => {
      const baseWithExtremeRates = {
        ...mockBaseCountry,
        adjustedGdpGrowth: 0.95, // 95% is too high, should clamp to 50%
        populationGrowthRate: -0.8, // -80% is too low, should clamp to -50%
      };
      const stats = calculator.initializeCountryStats(baseWithExtremeRates);
      expect(stats.adjustedGdpGrowth).toBe(0.5);
      expect(stats.populationGrowthRate).toBe(-0.5);
    });
  });

  describe("calculateTimeProgression math correctness", () => {
    it("should compound GDP per capita accurately including global growth factor", () => {
      // 1 year progression
      const baselineStats = calculator.initializeCountryStats(mockBaseCountry);
      const targetTime = IxTime.addYears(calculator.getBaselineDate(), 1);

      const result = calculator.calculateTimeProgression(baselineStats, targetTime);

      // Expected growth: base rate (0.03) * global growth factor (1.0321) = 0.030963
      // Compounded: 30000 * (1 + 0.030963)^1 = 30928.89
      expect(result.newStats.currentGdpPerCapita).toBeCloseTo(30928.89, 1);
    });

    it("should respect maximum growth rate caps for each of the 7 tiers", () => {
      // Developing economy cap is 7.5% (0.075), range $10,000 - $24,999
      const developingBase = {
        ...mockBaseCountry,
        gdpPerCapita: 15000,
        adjustedGdpGrowth: 0.1, // 10% base rate is set
      };

      const baselineStats = calculator.initializeCountryStats(developingBase);
      const targetTime = IxTime.addYears(calculator.getBaselineDate(), 1);

      const result = calculator.calculateTimeProgression(baselineStats, targetTime);

      // Since it's developing, max cap is 0.075. 10% * global factor would exceed this.
      // Expected growth: 15000 * (1 + 0.075)^1 = 16125.00
      expect(result.newStats.currentGdpPerCapita).toBeCloseTo(16125.0, 1);
    });

    it("should apply diminishing returns logarithmic reduction for ultra high GDP", () => {
      // GDP PC of $90k is > $60k diminishing returns threshold
      const ultraHighBase = {
        ...mockBaseCountry,
        gdpPerCapita: 90000,
        adjustedGdpGrowth: 0.004, // 0.4% base growth (under extravagant cap of 0.5%)
      };

      const baselineStats = calculator.initializeCountryStats(ultraHighBase);
      const targetTime = IxTime.addYears(calculator.getBaselineDate(), 1);

      const result = calculator.calculateTimeProgression(baselineStats, targetTime);

      // effective growth = 0.004 * 1.0321 = 0.0041284
      // diminishingFactor = log2(90000 / 60000 + 1) = log2(2.5) = 1.3219
      // divisor = 1 + 1.3219 * 0.5 = 1.66095
      // rate = 0.0041284 / 1.66095 = 0.0024855
      // Expected: 90000 * (1 + 0.0024855)^1 = 90223.7
      expect(result.newStats.currentGdpPerCapita).toBeLessThan(90000 * 1.0041284);
      expect(result.newStats.currentGdpPerCapita).toBeCloseTo(90223.7, 0);
    });
  });
});

describe("Sandbox Economic Modeling Engine (economic-modeling-engine.ts)", () => {
  const modelParams = {
    baseYear: 2026,
    projectionYears: 5,
    gdpGrowthRate: 3.5, // 3.5%
    inflationRate: 2.1,
    unemploymentRate: 5.2,
    interestRate: 3.2,
    exchangeRate: 1.0,
    populationGrowthRate: 1.1, // 1.1%
    investmentRate: 22.0,
    fiscalBalance: -1.5,
    tradeBalance: 0.5,
  };

  it("should project compound growth using percentage rates (dividing by 100)", () => {
    const projections = calculateGdpProjections(modelParams, 1000000000, 5000000, []);

    expect(projections.length).toBe(5);
    expect(projections[0]?.year).toBe("2026");
    // Year 1 growth: 1B * (1 + 3.5 / 100) = 1.035B
    expect(projections[0]?.gdp).toBe(1035000000);
  });

  it("should calculate correct health ratings and generate relevant warnings", () => {
    const health = calculateModelHealth(modelParams);
    expect(health.score).toBeGreaterThanOrEqual(70);
    expect(health.status).toBe("excellent");

    const badParams = {
      ...modelParams,
      gdpGrowthRate: -2.5, // contraction warning
      inflationRate: 12.0, // high inflation warning
      unemploymentRate: 18.0, // high unemployment warning
    };

    const badHealth = calculateModelHealth(badParams);
    expect(badHealth.warnings.length).toBe(3);
    expect(badHealth.status).toBe("poor");
  });

  it("should correctly validate parameter ranges", () => {
    const validResult = validateModelParameters(modelParams);
    expect(validResult.valid).toBe(true);

    const invalidParams = {
      ...modelParams,
      gdpGrowthRate: 45.0, // Out of [-20, 20] range
    };

    const invalidResult = validateModelParameters(invalidParams);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBe(1);
  });
});

describe("Calculation Groups Compatibility & Refactoring Verification (economic-calculation-groups.ts)", () => {
  let groups: EconomicCalculationGroups;
  let baseStats: CountryStats;

  beforeEach(() => {
    groups = new EconomicCalculationGroups(mockConfig);
    const baseCalc = new IxStatsCalculator(mockConfig, Date.now());
    baseStats = baseCalc.initializeCountryStats(mockBaseCountry);
  });

  it("should successfully run sustainability scores on the 7 active tiers", () => {
    const impoverishedStats = { ...baseStats, economicTier: EconomicTier.IMPOVERISHED };
    const impoverishedDynamics = groups.calculateGrowthDynamics(impoverishedStats, mockEconomyData);
    expect(impoverishedDynamics.components.growthSustainability).toBeGreaterThan(0);

    const developedStats = { ...baseStats, economicTier: EconomicTier.DEVELOPED };
    const developedDynamics = groups.calculateGrowthDynamics(developedStats, mockEconomyData);
    expect(developedDynamics.components.growthSustainability).toBeGreaterThan(0);
  });

  it("should handle 4-tier fallback values (Emerging and Advanced) safely without falling to bad defaults", () => {
    // Emerging should run in the high growth sustainability case
    const emergingStats = { ...baseStats, economicTier: "Emerging" as any };
    const emergingDynamics = groups.calculateGrowthDynamics(emergingStats, mockEconomyData);

    // Advanced should run in the mature default case
    const advancedStats = { ...baseStats, economicTier: "Advanced" as any };
    const advancedDynamics = groups.calculateGrowthDynamics(advancedStats, mockEconomyData);

    // Emerging (high potential growth rate) should score higher or equal to Advanced (mature low rate)
    expect(emergingDynamics.components.growthSustainability).toBeGreaterThan(
      advancedDynamics.components.growthSustainability
    );
  });
});
