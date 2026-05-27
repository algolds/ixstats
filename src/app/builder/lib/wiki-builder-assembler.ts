/**
 * Wiki Builder Assembler — Ties all wiki parsers together and assembles
 * a complete BuilderState from infobox data + parsed wiki attributes.
 */

import type { UnifiedInfoboxData } from "~/lib/unified-wiki-parser";
import type { ComponentType } from "~/lib/enums";
import type {
  EconomicInputs,
  NationalIdentityData,
  CoreEconomicIndicators,
  LaborEmploymentData,
  FiscalSystemData,
  IncomeWealthData,
  DemographicData,
  GeographyData,
} from "../lib/economy-data-service";
import type {
  GovernmentBuilderState,
  DepartmentInput,
  BudgetAllocationInput,
  RevenueSourceInput,
  GovernmentType,
} from "~/types/government";
import type { GovernmentSpendingData } from "~/types/economics";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { ExtractedBuilderData } from "./wiki-data-extractor";
import type { WikiGovernmentAttributes } from "./wiki-government-parser";
import type { WikiEconomyAttributes } from "./wiki-economy-parser";
import type { ParsedDepartment } from "./wiki-department-parser";
import type { WikiRevenueAttributes } from "./wiki-revenue-parser";
import type { MatchResult } from "./wiki-attribute-matcher";
import type { ConflictReport } from "./wiki-conflict-detector";
import { parseGovernmentAttributes } from "./wiki-government-parser";
import { parseEconomyAttributes } from "./wiki-economy-parser";
import { parseDepartments } from "./wiki-department-parser";
import { parseRevenueSources } from "./wiki-revenue-parser";
import { matchComponents } from "./wiki-attribute-matcher";
import { detectWikiImportConflicts } from "./wiki-conflict-detector";

export interface WikiImportResult {
  economicInputs: EconomicInputs;
  governmentStructure: Partial<GovernmentBuilderState>;
  economyBuilderState: Partial<EconomyBuilderState>;
  selectedComponents: MatchResult["selected"];
  suggestedComponents: MatchResult["suggested"];
  parsedDepartments: ParsedDepartment[];
  revenueSources: WikiRevenueAttributes["sources"];
  overallCompleteness: number;
  sectionCompleteness: Record<string, number>;
  conflicts: ConflictReport[];
  warnings: string[];
  matchResult: MatchResult;
}

interface AssembleInput {
  infoboxData: UnifiedInfoboxData;
  pages: { title: string; content: string }[];
}

function parseWikiNumericValue(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.match(/([\d,\.]+)\s*(trillion|billion|million|thousand)?/i);
  if (!match) return null;
  let num = parseFloat(match[1]!.replace(/,/g, ""));
  if (isNaN(num)) return null;
  const mult = match[2]?.toLowerCase();
  if (mult === "trillion") num *= 1e12;
  else if (mult === "billion") num *= 1e9;
  else if (mult === "million") num *= 1e6;
  else if (mult === "thousand") num *= 1e3;
  return num > 0 ? num : null;
}

function normalizeGovernmentType(raw: string): string {
  const normalized = raw.trim();
  const knownTypes = [
    "Constitutional Monarchy",
    "Federal Republic",
    "Parliamentary Democracy",
    "Presidential Republic",
    "Federal Constitutional Republic",
    "Unitary State",
    "Federation",
    "Confederation",
    "Empire",
    "City-State",
  ];
  for (const known of knownTypes) {
    if (normalized.toLowerCase() === known.toLowerCase()) return known;
  }
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase()) || "Other";
}

function getEconomicTier(
  gdpPerCapita: number
): "Developing" | "Emerging" | "Developed" | "Advanced" {
  if (gdpPerCapita > 50000) return "Advanced";
  if (gdpPerCapita > 20000) return "Developed";
  if (gdpPerCapita > 5000) return "Emerging";
  return "Developing";
}

function createDefaultNationalIdentity(
  name: string,
  infobox: UnifiedInfoboxData
): NationalIdentityData {
  return {
    countryName: name,
    officialName: infobox.official_name || infobox.conventional_long_name || name,
    governmentType: infobox.government_type
      ? normalizeGovernmentType(infobox.government_type)
      : "Republic",
    motto: infobox.motto || infobox.national_motto || "",
    mottoNative: "",
    capitalCity: infobox.capital || "",
    largestCity: infobox.largest_city || "",
    demonym: infobox.demonym || "",
    currency: infobox.currency || "",
    officialLanguages: infobox.official_languages || infobox.languages || "",
    nationalLanguage: "",
    nationalAnthem: infobox.national_anthem || "",
    nationalReligion: infobox.religion,
    nationalDay: "",
    callingCode: infobox.calling_code || "",
    internetTLD: infobox.internet_tld || "",
    drivingSide: infobox.drives_on?.toLowerCase().includes("left") ? "left" : "right",
    currencySymbol: infobox.currency_code,
    isoCode: infobox.iso_code,
    timeZone: infobox.time_zone,
    coordinatesLatitude: infobox.coordinates?.[0]?.toString(),
    coordinatesLongitude: infobox.coordinates?.[1]?.toString(),
  };
}

function createDefaultCoreIndicators(infobox: UnifiedInfoboxData): CoreEconomicIndicators {
  const popValue = infobox.population ?? infobox.population_estimate ?? infobox.population_census;
  const totalPopulation = parseWikiNumericValue(popValue) ?? 10000000;

  const gdpPcValue =
    infobox.gdpPerCapita ?? infobox.GDP_nominal_per_capita ?? infobox.GDP_PPP_per_capita;
  const gdpPerCapita = parseWikiNumericValue(gdpPcValue) ?? 25000;

  const gdpNomValue =
    infobox.gdp_nominal ?? infobox.GDP_nominal ?? infobox.gdp_ppp ?? infobox.GDP_PPP;
  let nominalGDP = parseWikiNumericValue(gdpNomValue) ?? null;
  if (!nominalGDP && totalPopulation && gdpPerCapita) {
    nominalGDP = totalPopulation * gdpPerCapita;
  }
  nominalGDP ??= 1000000000;

  return {
    totalPopulation,
    nominalGDP,
    gdpPerCapita,
    realGDPGrowthRate: 2.5,
    inflationRate: 2.0,
    currencyExchangeRate: 1.0,
  };
}

function createDefaultLaborEmployment(
  core: CoreEconomicIndicators,
  tier: ReturnType<typeof getEconomicTier>
): LaborEmploymentData {
  const participationRate = tier === "Advanced" ? 68 : tier === "Developed" ? 65 : 60;
  const employmentRate = tier === "Advanced" ? 96 : tier === "Developed" ? 94 : 90;
  const totalWorkforce = Math.round(
    core.totalPopulation * (participationRate / 100) * (employmentRate / 100)
  );

  return {
    laborForceParticipationRate: participationRate,
    employmentRate,
    unemploymentRate: 100 - employmentRate,
    totalWorkforce,
    averageWorkweekHours: 40,
    minimumWage: Math.max(core.gdpPerCapita * 0.08, 5),
    averageAnnualIncome: core.gdpPerCapita * 0.6,
    laborProtections: tier !== "Developing",
  };
}

function createDefaultFiscalSystem(
  core: CoreEconomicIndicators,
  tier: ReturnType<typeof getEconomicTier>
): FiscalSystemData {
  const taxRevenuePercent = tier === "Advanced" ? 35 : tier === "Developed" ? 25 : 18;
  const budgetPercent = tier === "Advanced" ? 40 : tier === "Developed" ? 30 : 22;
  const totalRevenue = core.nominalGDP * (taxRevenuePercent / 100);

  return {
    taxRevenueGDPPercent: taxRevenuePercent,
    governmentRevenueTotal: totalRevenue,
    taxRevenuePerCapita: totalRevenue / core.totalPopulation,
    taxRates: {
      personalIncomeTaxRates: [{ bracket: 50000, rate: tier === "Advanced" ? 35 : 20 }],
      corporateTaxRates: [{ size: "All", rate: tier === "Advanced" ? 25 : 20 }],
      salesTaxRate: tier === "Advanced" ? 20 : 10,
      propertyTaxRate: 1.0,
      payrollTaxRate: 10,
      exciseTaxRates: [],
      wealthTaxRate: tier === "Advanced" ? 1 : 0,
      income: [{ bracket: 50000, rate: tier === "Advanced" ? 35 : 20 }],
      corporate: [{ size: "All", rate: tier === "Advanced" ? 25 : 20 }],
      sales: tier === "Advanced" ? 20 : 10,
    },
    governmentBudgetGDPPercent: budgetPercent,
    budgetDeficitSurplus: -2,
    governmentSpendingByCategory: [],
    internalDebtGDPPercent: tier === "Advanced" ? 80 : 40,
    externalDebtGDPPercent: tier === "Advanced" ? 30 : 20,
    totalDebtGDPRatio: tier === "Advanced" ? 110 : 60,
    debtPerCapita: (core.nominalGDP * (tier === "Advanced" ? 1.1 : 0.6)) / core.totalPopulation,
    interestRates: 3.0,
    debtServiceCosts: core.nominalGDP * 0.02,
    incomeTaxRate: tier === "Advanced" ? 35 : 20,
    corporateTaxRate: tier === "Advanced" ? 25 : 20,
    salesTaxRate: tier === "Advanced" ? 20 : 10,
    progressiveTaxation: tier !== "Developing",
    balancedBudgetRule: false,
    debtCeiling: core.nominalGDP * 1.5,
    antiAvoidance: tier !== "Developing",
  };
}

function createDefaultIncomeWealth(
  core: CoreEconomicIndicators,
  tier: ReturnType<typeof getEconomicTier>
): IncomeWealthData {
  const gini = tier === "Advanced" ? 0.3 : tier === "Developed" ? 0.35 : 0.45;
  return {
    economicClasses: [
      {
        name: "Upper Class",
        populationPercent: 5,
        wealthPercent: 60,
        averageIncome: core.gdpPerCapita * 5,
        color: "#f59e0b",
      },
      {
        name: "Middle Class",
        populationPercent: 40,
        wealthPercent: 30,
        averageIncome: core.gdpPerCapita * 1.2,
        color: "#3b82f6",
      },
      {
        name: "Working Class",
        populationPercent: 40,
        wealthPercent: 8,
        averageIncome: core.gdpPerCapita * 0.5,
        color: "#10b981",
      },
      {
        name: "Lower Class",
        populationPercent: 15,
        wealthPercent: 2,
        averageIncome: core.gdpPerCapita * 0.2,
        color: "#ef4444",
      },
    ],
    povertyRate: tier === "Advanced" ? 10 : tier === "Developed" ? 15 : 25,
    incomeInequalityGini: gini,
    socialMobilityIndex: tier === "Advanced" ? 70 : tier === "Developed" ? 55 : 40,
  };
}

function createDefaultDemographics(
  core: CoreEconomicIndicators,
  infobox: UnifiedInfoboxData
): DemographicData {
  const lifeExp = parseWikiNumericValue(infobox.life_expectancy) ?? 72;
  const literacy = parseWikiNumericValue(infobox.literacy_rate) ?? 90;
  const urbanization = parseWikiNumericValue(infobox.urbanization) ?? 65;

  return {
    ageDistribution: [
      { group: "0-14", percent: 20, color: "#8b5cf6" },
      { group: "15-24", percent: 15, color: "#6366f1" },
      { group: "25-54", percent: 40, color: "#3b82f6" },
      { group: "55-64", percent: 10, color: "#10b981" },
      { group: "65+", percent: 15, color: "#f59e0b" },
    ],
    lifeExpectancy: lifeExp,
    urbanRuralSplit: { urban: urbanization, rural: 100 - urbanization },
    regions: [],
    educationLevels: [
      { level: "No Education", percent: Math.max(100 - literacy - 50, 0), color: "#ef4444" },
      { level: "Primary", percent: 20, color: "#f59e0b" },
      { level: "Secondary", percent: 50, color: "#3b82f6" },
      { level: "Tertiary", percent: Math.min((literacy - 50) / 2, 30), color: "#10b981" },
    ],
    literacyRate: literacy,
    citizenshipStatuses: [],
    education: literacy,
    populationGrowthRate: 1.0,
  };
}

function createDefaultGovernmentSpending(
  govAttrs: WikiGovernmentAttributes,
  econAttrs: WikiEconomyAttributes,
  core: CoreEconomicIndicators,
  tier: ReturnType<typeof getEconomicTier>
): GovernmentSpendingData {
  const hasWelfare =
    govAttrs.socialPolicies.some((p) => p.type === "welfare_state" && p.confidence >= 80) ||
    econAttrs.hasWelfarePrograms;
  const hasHealthcare =
    govAttrs.socialPolicies.some((p) => p.type === "universal_healthcare" && p.confidence >= 80) ||
    econAttrs.hasUniversalHealthcare;
  const hasEducation =
    govAttrs.socialPolicies.some((p) => p.type === "public_education" && p.confidence >= 80) ||
    econAttrs.hasPublicEducation;
  const hasEnvProtection = govAttrs.socialPolicies.some(
    (p) => p.type === "environmental_protection" && p.confidence >= 80
  );
  const hasDigitalGov = govAttrs.administrativeFeatures.some(
    (f) => f.type === "digital_government" && f.confidence >= 80
  );

  return {
    education: tier === "Advanced" ? 5 : 3,
    healthcare: hasHealthcare ? 7 : tier === "Advanced" ? 5 : 3,
    socialSafety: hasWelfare ? 8 : 4,
    totalSpending: core.nominalGDP * 0.35,
    spendingGDPPercent: 35,
    spendingPerCapita: (core.nominalGDP * 0.35) / core.totalPopulation,
    deficitSurplus: -2,
    spendingCategories: [],
    performanceBasedBudgeting: false,
    universalBasicServices: hasWelfare,
    greenInvestmentPriority: hasEnvProtection,
    digitalGovernmentInitiative: hasDigitalGov,
    zeroBasedBudgeting: false,
    publicPrivatePartnerships: false,
    participatoryBudgeting: false,
    emergencyReserveFund: true,
    socialImpactBonds: false,
    childWelfareFirstPolicy: hasWelfare,
    preventiveCareEmphasis: hasHealthcare,
    infrastructureBankFund: false,
    universalBasicIncome: false,
    progressiveTaxation: tier !== "Developing",
    carbonTax: hasEnvProtection,
    wealthTax: tier === "Advanced",
    financialTransactionTax: false,
    universalHealthcare: hasHealthcare,
    freeEducation: hasEducation,
    affordableHousing: hasWelfare,
    elderlyCare: hasWelfare,
    disabilitySupport: hasWelfare,
    mentalHealthServices: hasHealthcare,
    stemEducationFocus: false,
    vocationalTraining: hasEducation,
    adultEducation: hasEducation,
    earlyChildhoodEducation: hasEducation,
    smartCityInitiative: false,
    publicTransportExpansion: false,
    renewableEnergyTransition: hasEnvProtection,
    highSpeedInternet: false,
    waterInfrastructure: false,
    researchDevelopmentFund: tier === "Advanced",
    startupIncubators: false,
    patentReform: false,
    openDataInitiative: false,
    cybersecurityInitiative: false,
    borderSecurity: false,
    disasterPreparedness: false,
    crimePrevention: false,
    carbonNeutrality: hasEnvProtection,
    biodiversityProtection: hasEnvProtection,
    wasteReduction: false,
    greenBuildingStandards: false,
    sustainableAgriculture: false,
    criminalJusticeReform: false,
    legalAidExpansion: false,
    restorativeJustice: false,
    courtSystemModernization: false,
    artsCultureFunding: false,
    heritagePreservation: false,
    multiculturalPrograms: false,
    languagePreservation: false,
    ruralDevelopment: false,
    ruralHealthcare: false,
    ruralBroadband: false,
    agriculturalSupport: false,
    foreignAidProgram: false,
    refugeeSupport: false,
    diplomaticEngagement: false,
    tradePromotion: false,
    transparencyInitiative: false,
    citizenEngagement: false,
    antiCorruption: false,
    publicServiceReform: false,
  };
}

function createDepartmentsFromParsed(
  parsed: ParsedDepartment[],
  totalBudget: number
): { departments: DepartmentInput[]; allocations: BudgetAllocationInput[] } {
  const departments: DepartmentInput[] = [];
  const allocations: BudgetAllocationInput[] = [];

  for (const dept of parsed) {
    const deptInput: DepartmentInput = {
      name: dept.name,
      category: dept.category,
      description: dept.description || `Government ${dept.category.toLowerCase()} department`,
      minister: dept.minister,
      ministerTitle: "Minister",
      headquarters: "",
      established: "",
      employeeCount: 0,
      icon: "",
      color: "#6366f1",
      priority: 50,
      organizationalLevel: "Ministry",
      functions: [],
    };
    departments.push(deptInput);
    allocations.push({
      departmentId: dept.name,
      allocatedPercent: 5,
      budgetYear: new Date().getFullYear(),
      allocatedAmount: totalBudget * 0.05,
    });
  }

  return { departments, allocations };
}

function createRevenueSourcesFromParsed(
  revenueAttrs: WikiRevenueAttributes,
  totalRevenue: number
): RevenueSourceInput[] {
  return revenueAttrs.sources.map((source) => ({
    name: source.name,
    category: source.category,
    description: `Revenue from ${source.name.toLowerCase()}`,
    rate: source.category === "Direct Tax" ? 20 : source.category === "Indirect Tax" ? 10 : 0,
    revenueAmount: totalRevenue / Math.max(revenueAttrs.sources.length, 1),
    collectionMethod: "",
    administeredBy: "",
  }));
}

function calculateCompleteness(
  infobox: UnifiedInfoboxData,
  matchResult: MatchResult,
  departments: ParsedDepartment[]
): Record<string, number> {
  const identityFields = [
    "name",
    "official_name",
    "government_type",
    "capital",
    "currency",
    "languages",
    "motto",
    "demonym",
    "national_anthem",
    "religion",
    "calling_code",
    "internet_tld",
    "time_zone",
    "iso_code",
    "drives_on",
  ];
  const identityFilled = identityFields.filter(
    (f) => infobox[f as keyof UnifiedInfoboxData]
  ).length;
  const identityPct = Math.round((identityFilled / identityFields.length) * 100);

  const coreFields = ["population", "gdpPerCapita", "gdp_nominal"];
  const coreFilled = coreFields.filter((f) => infobox[f as keyof UnifiedInfoboxData]).length;
  const corePct = Math.round((coreFilled / coreFields.length) * 100);

  const govPct =
    matchResult.selected.length > 0
      ? Math.min(100, Math.round((matchResult.selected.length / 5) * 100))
      : infobox.government_type
        ? 40
        : 0;
  const econPct = infobox.GDP_nominal || infobox.gdp_nominal ? 75 : 0;
  const demoPct = infobox.population || infobox.population_estimate ? 80 : 0;
  const laborPct = 40;
  const fiscalPct = 35;

  return {
    nationalIdentity: identityPct,
    coreIndicators: corePct,
    government: govPct,
    economy: econPct,
    demographics: demoPct,
    laborMarket: laborPct,
    fiscalSystem: fiscalPct,
  };
}

export async function assembleWikiImport(input: AssembleInput): Promise<WikiImportResult> {
  const { infoboxData, pages } = input;
  const name =
    infoboxData.name ||
    infoboxData.common_name ||
    infoboxData.conventional_long_name ||
    "Unknown Nation";

  // Parse all wiki attributes
  const govAttrs = parseGovernmentAttributes(pages, infoboxData.government_type);
  const econAttrs = parseEconomyAttributes(pages);
  const departments = parseDepartments(pages);
  const revenueAttrs = parseRevenueSources(pages);

  // Match components
  const matchResult = matchComponents({
    government: govAttrs,
    economy: econAttrs,
    infoboxGovType: infoboxData.government_type,
  });

  // Build economic inputs
  const core = createDefaultCoreIndicators(infoboxData);
  const tier = getEconomicTier(core.gdpPerCapita);
  const nationalIdentity = createDefaultNationalIdentity(name, infoboxData);
  const labor = createDefaultLaborEmployment(core, tier);
  const fiscal = createDefaultFiscalSystem(core, tier);
  const incomeWealth = createDefaultIncomeWealth(core, tier);
  const demographics = createDefaultDemographics(core, infoboxData);
  const governmentSpending = createDefaultGovernmentSpending(govAttrs, econAttrs, core, tier);

  const economicInputs: EconomicInputs = {
    countryName: name,
    flagUrl: infoboxData.flagUrl,
    coatOfArmsUrl: infoboxData.coatOfArmsUrl,
    nationalIdentity,
    geography: { continent: infoboxData.continent },
    coreIndicators: core,
    laborEmployment: labor,
    fiscalSystem: fiscal,
    incomeWealth,
    governmentSpending: governmentSpending,
    demographics,
  };

  // Build government structure
  const totalBudget = core.nominalGDP * 0.35;
  const { departments: deptInputs, allocations } = createDepartmentsFromParsed(
    departments,
    totalBudget
  );
  const revenueSources = createRevenueSourcesFromParsed(
    revenueAttrs,
    fiscal.governmentRevenueTotal
  );

  const govType = infoboxData.government_type
    ? normalizeGovernmentType(infoboxData.government_type)
    : "Other";
  const governmentStructure: Partial<GovernmentBuilderState> = {
    structure: {
      governmentName: `Government of ${name}`,
      governmentType: govType as GovernmentType,
      headOfState: infoboxData.head_of_state || "",
      headOfGovernment: infoboxData.head_of_government || "",
      legislatureName: infoboxData.legislature || infoboxData.upper_house || "",
      executiveName: "",
      judicialName: "",
      totalBudget,
      fiscalYear: "Calendar Year",
      budgetCurrency: infoboxData.currency_code || infoboxData.currency || "USD",
    },
    departments: deptInputs,
    budgetAllocations: allocations,
    revenueSources,
  };

  // Build economy builder state
  const economyBuilderState: Partial<EconomyBuilderState> = {
    structure: {
      economicModel:
        econAttrs.economicSystem === "free_market"
          ? "Market Economy"
          : econAttrs.economicSystem === "planned"
            ? "Planned Economy"
            : "Mixed Economy",
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: core.nominalGDP,
      gdpCurrency: infoboxData.currency_code || infoboxData.currency || "USD",
      economicTier: tier,
      growthStrategy: "Balanced",
    },
    sectors: [],
    laborMarket: {
      totalWorkforce: labor.totalWorkforce,
      laborForceParticipationRate: labor.laborForceParticipationRate,
      employmentRate: labor.employmentRate,
      unemploymentRate: labor.unemploymentRate,
      underemploymentRate: 8,
      youthUnemploymentRate: 12,
      seniorEmploymentRate: 35,
      femaleParticipationRate: 50,
      maleParticipationRate: 70,
      sectorDistribution: {
        agriculture: 5,
        mining: 2,
        manufacturing: 15,
        construction: 8,
        utilities: 2,
        wholesale: 5,
        retail: 10,
        transportation: 5,
        information: 3,
        finance: 5,
        professional: 10,
        education: 6,
        healthcare: 8,
        hospitality: 5,
        government: 8,
        other: 3,
      },
      employmentType: {
        fullTime: 70,
        partTime: 15,
        temporary: 8,
        seasonal: 0,
        selfEmployed: 5,
        gig: 2,
        informal: 0,
      },
      averageWorkweekHours: 40,
      minimumWage: labor.minimumWage,
      averageWage: core.gdpPerCapita * 0.6,
      medianWage: core.gdpPerCapita * 0.5,
      wageGrowthRate: 2.5,
      unionizationRate: 20,
      collectiveBargainingCoverage: 25,
      workersRights: tier !== "Developing" ? "Moderate" : "Basic",
      workplaceSafety: "Standard",
      antiDiscriminationLaws: tier !== "Developing",
      equalPayLegislation: tier !== "Developing",
      parentalLeaveWeeks: 12,
      paidVacationDays: 20,
      sickLeaveDays: 10,
      retirementAge: 65,
      pensionSystem: "Mixed",
      unemploymentBenefits: tier !== "Developing",
      jobTrainingPrograms: true,
    } as any,
    demographics: {
      totalPopulation: core.totalPopulation,
      populationGrowthRate: 1.0,
      ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
      urbanRuralSplit: demographics.urbanRuralSplit,
      regions: [],
      lifeExpectancy: demographics.lifeExpectancy,
      literacyRate: demographics.literacyRate,
      educationLevels: { noEducation: 5, primary: 20, secondary: 50, tertiary: 25 },
      netMigrationRate: 0,
      immigrationRate: 3,
      emigrationRate: 3,
      infantMortalityRate: 5,
      maternalMortalityRate: 10,
      healthExpenditureGDP: 8,
      youthDependencyRatio: 30,
      elderlyDependencyRatio: 23,
      totalDependencyRatio: 53,
    },
    selectedAtomicComponents: [],
    isValid: false,
    errors: {},
    lastUpdated: new Date(),
    version: "1.0.0",
  };

  // Detect conflicts
  const conflicts = detectWikiImportConflicts(matchResult, {
    gdpInfobox: core.nominalGDP,
    gdpEconomyBuilder: economyBuilderState.structure?.totalGDP,
    totalBudget,
    budgetAllocations: allocations,
  });

  // Calculate completeness
  const sectionCompleteness = calculateCompleteness(infoboxData, matchResult, departments);
  const overallCompleteness = Math.round(
    Object.values(sectionCompleteness).reduce((a, b) => a + b, 0) /
      Object.keys(sectionCompleteness).length
  );

  // Generate warnings
  const warnings: string[] = [];
  if (matchResult.missingEssential.length > 0) {
    warnings.push(
      `Missing essential government components: ${matchResult.missingEssential.join(", ")}`
    );
  }
  if (departments.length === 0) {
    warnings.push("No government departments found in wiki pages — defaults will be used.");
  }
  if (revenueAttrs.sources.length === 0) {
    warnings.push("No revenue sources found at ≥95% confidence — defaults will be used.");
  }
  if (overallCompleteness < 50) {
    warnings.push(
      "Low data completeness — many fields will use derived defaults. Review all sections in the builder."
    );
  }

  return {
    economicInputs,
    governmentStructure,
    economyBuilderState,
    selectedComponents: matchResult.selected,
    suggestedComponents: matchResult.suggested,
    parsedDepartments: departments,
    revenueSources: revenueAttrs.sources,
    overallCompleteness,
    sectionCompleteness,
    conflicts,
    warnings,
    matchResult,
  };
}
