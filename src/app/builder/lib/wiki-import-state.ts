import type { DepartmentCategory, GovernmentType } from "~/types/government";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { NationalIdentityData } from "~/types/builder";
import type { ComponentType } from "~/lib/enums";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import type { BuilderState } from "../hooks/builderStateTypes";
import { firstPlainText, normalizeGovernmentType, parseWikiNumericValue } from "./builder-parsers";
import { STARTING_EMPLOYMENT_TYPE, STARTING_SECTOR_DISTRIBUTION } from "./default-labor-market";
import { createDefaultEconomicInputs } from "./economy-data-service";

type WikiNumber = string | number | null;

export interface WikiImportPayload {
  name?: string;
  population?: WikiNumber;
  population_estimate?: WikiNumber;
  population_census?: WikiNumber;
  gdpPerCapita?: WikiNumber;
  GDP_nominal_per_capita?: WikiNumber;
  GDP_PPP_per_capita?: WikiNumber;
  gdp_nominal?: WikiNumber;
  GDP_nominal?: WikiNumber;
  gdp_ppp?: WikiNumber;
  GDP_PPP?: WikiNumber;
  official_name?: string;
  conventional_long_name?: string;
  government_type?: string;
  motto?: string;
  national_motto?: string;
  demonym?: string;
  national_anthem?: string;
  religion?: string;
  capital?: string;
  largest_city?: string;
  currency?: string;
  currency_code?: string;
  languages?: string;
  calling_code?: string;
  internet_tld?: string;
  time_zone?: string;
  iso_code?: string;
  drives_on?: string;
  coordinates?: string | number;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  coat_of_arms?: string;
  head_of_state?: string;
  head_of_government?: string;
  legislature?: string;
  upper_house?: string;
  urbanization?: string | number;
  life_expectancy?: string | number;
  literacy_rate?: string | number;
  _importResult?: {
    selectedComponents?: ComponentType[];
    parsedDepartments?: Array<{
      name: string;
      category?: string;
      description?: string;
      minister?: string;
    }>;
  };
}

type WikiTextKey = {
  [K in keyof WikiImportPayload]-?: NonNullable<WikiImportPayload[K]> extends string ? K : never;
}[keyof WikiImportPayload];

/** Identity fields copied from the first non-empty wiki infobox key listed for them. */
const IDENTITY_SOURCES: ReadonlyArray<[keyof NationalIdentityData, ...WikiTextKey[]]> = [
  ["countryName", "name"],
  ["officialName", "official_name", "conventional_long_name"],
  ["motto", "motto", "national_motto"],
  ["demonym", "demonym"],
  ["nationalAnthem", "national_anthem"],
  ["nationalReligion", "religion"],
  ["capitalCity", "capital"],
  ["largestCity", "largest_city"],
  ["currency", "currency"],
  ["currencySymbol", "currency_code"],
  ["officialLanguages", "languages"],
  ["callingCode", "calling_code"],
  ["internetTLD", "internet_tld"],
  ["timeZone", "time_zone"],
  ["isoCode", "iso_code"],
];

const BLANK_IDENTITY: NationalIdentityData = {
  countryName: "",
  officialName: "",
  governmentType: "republic",
  motto: "",
  mottoNative: "",
  capitalCity: "",
  largestCity: "",
  demonym: "",
  currency: "",
  officialLanguages: "",
  nationalLanguage: "",
  nationalAnthem: "",
  nationalReligion: "",
  nationalDay: "",
  callingCode: "",
  internetTLD: "",
  drivingSide: "right",
  timeZone: "",
  isoCode: "",
  currencySymbol: "",
  coordinatesLatitude: "",
  coordinatesLongitude: "",
};

const ECONOMIC_TIERS = [
  [50000, "Advanced"],
  [20000, "Developed"],
  [5000, "Emerging"],
] as const;

const economicTierFor = (gdpPerCapita: number): EconomyBuilderState["structure"]["economicTier"] =>
  ECONOMIC_TIERS.find(([floor]) => gdpPerCapita > floor)?.[1] ?? "Developing";

function buildIdentity(wiki: WikiImportPayload): NationalIdentityData {
  const identity = { ...BLANK_IDENTITY };
  for (const [field, ...keys] of IDENTITY_SOURCES) {
    const value = firstPlainText(...keys.map((key) => wiki[key]));
    if (value) Reflect.set(identity, field, value);
  }
  if (wiki.government_type) identity.governmentType = normalizeGovernmentType(wiki.government_type);
  if (wiki.drives_on) {
    identity.drivingSide = wiki.drives_on.toLowerCase().includes("left") ? "left" : "right";
  }
  const coords = wiki.coordinates ? String(wiki.coordinates) : "";
  if (coords.includes("N") || coords.includes("S")) {
    const [latitude, longitude] = coords.split(",");
    identity.coordinatesLatitude = latitude || coords;
    identity.coordinatesLongitude = longitude || "";
  }
  return identity;
}

function buildEconomyState(
  wiki: WikiImportPayload,
  totalPop: number,
  totalGdp: number
): EconomyBuilderState {
  const gdpPerCapita = totalGdp / totalPop;
  const urbanization = parseWikiNumericValue(wiki.urbanization) ?? 75;
  return {
    structure: {
      economicModel: "Mixed Economy",
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: totalGdp,
      gdpCurrency: wiki.currency_code || wiki.currency || "USD",
      economicTier: economicTierFor(gdpPerCapita),
      growthStrategy: "Balanced",
    },
    sectors: [],
    laborMarket: {
      totalWorkforce: Math.round(totalPop * 0.65 * 0.94),
      laborForceParticipationRate: 65,
      employmentRate: 94,
      unemploymentRate: 6,
      underemploymentRate: 8,
      youthUnemploymentRate: 12,
      seniorEmploymentRate: 35,
      femaleParticipationRate: 50,
      maleParticipationRate: 70,
      sectorDistribution: { ...STARTING_SECTOR_DISTRIBUTION },
      employmentType: { ...STARTING_EMPLOYMENT_TYPE },
      averageAnnualIncome: gdpPerCapita * 0.6,
      averageWorkweekHours: 40,
      averageOvertimeHours: 2,
      paidVacationDays: 20,
      paidSickLeaveDays: 10,
      parentalLeaveWeeks: 12,
      unionizationRate: 20,
      collectiveBargainingCoverage: 25,
      minimumWageHourly: Math.max((gdpPerCapita * 0.08) / 2000, 5),
      livingWageHourly: Math.max((gdpPerCapita * 0.1) / 2000, 8),
      workplaceSafetyIndex: 75,
      laborRightsScore: 70,
      workerProtections: {
        jobSecurity: 70,
        wageProtection: 75,
        healthSafety: 80,
        discriminationProtection: 75,
        collectiveRights: 70,
      },
    },
    demographics: {
      totalPopulation: totalPop,
      populationGrowthRate: 1.0,
      ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
      urbanRuralSplit: { urban: urbanization, rural: 100 - urbanization },
      regions: [],
      lifeExpectancy: parseWikiNumericValue(wiki.life_expectancy) ?? 72,
      literacyRate: parseWikiNumericValue(wiki.literacy_rate) ?? 90,
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
}

function buildGovernmentStructure(
  wiki: WikiImportPayload,
  nominalGDP: number
): NonNullable<BuilderState["governmentStructure"]> {
  const parsedDepartments = wiki._importResult?.parsedDepartments ?? [];
  return {
    structure: {
      governmentName: `Government of ${wiki.name || "the Nation"}`,
      governmentType: (wiki.government_type
        ? normalizeGovernmentType(wiki.government_type)
        : "Other") as GovernmentType,
      headOfState: firstPlainText(wiki.head_of_state),
      headOfGovernment: firstPlainText(wiki.head_of_government),
      legislatureName: firstPlainText(wiki.legislature, wiki.upper_house),
      executiveName: "",
      judicialName: "",
      totalBudget: nominalGDP * 0.35,
      fiscalYear: "Calendar Year",
      budgetCurrency: wiki.currency || wiki.currency_code || "USD",
    },
    departments: parsedDepartments.map((d) => ({
      name: d.name,
      category: (d.category as DepartmentCategory) || "Other",
      description: d.description || `Government ${d.category?.toLowerCase() || ""} department`,
      minister: d.minister,
      ministerTitle: "Minister",
      headquarters: "",
      established: "",
      employeeCount: 0,
      icon: "",
      color: "#6366f1",
      priority: 50,
      organizationalLevel: "Ministry" as const,
      functions: [],
    })),
    budgetAllocations: [],
    revenueSources: [],
    isValid: false,
    errors: {},
  };
}

function buildEconomicInputs(wiki: WikiImportPayload) {
  const inputs = createDefaultEconomicInputs();
  const core = inputs.coreIndicators;
  const population = parseWikiNumericValue(
    wiki.population ?? wiki.population_estimate ?? wiki.population_census
  );
  const gdpPerCapita = parseWikiNumericValue(
    wiki.gdpPerCapita ?? wiki.GDP_nominal_per_capita ?? wiki.GDP_PPP_per_capita
  );
  const nominalGdp = parseWikiNumericValue(
    wiki.gdp_nominal ?? wiki.GDP_nominal ?? wiki.gdp_ppp ?? wiki.GDP_PPP
  );
  core.totalPopulation = population ?? core.totalPopulation;
  core.gdpPerCapita = gdpPerCapita ?? core.gdpPerCapita;
  core.nominalGDP = nominalGdp ?? core.nominalGDP;

  inputs.countryName = wiki.name || inputs.countryName;
  inputs.nationalIdentity = buildIdentity(wiki);
  if (wiki.flagUrl) inputs.flagUrl = normalizeFlagUrl(wiki.flagUrl) || "";
  const coatOfArms = wiki.coatOfArmsUrl || wiki.coat_of_arms;
  if (coatOfArms) inputs.coatOfArmsUrl = normalizeFlagUrl(coatOfArms) || "";

  const { laborEmployment, fiscalSystem } = inputs;
  laborEmployment.totalWorkforce = Math.round(
    core.totalPopulation * ((laborEmployment.laborForceParticipationRate || 65) / 100)
  );
  laborEmployment.minimumWage = Math.round(core.gdpPerCapita * 0.02);
  laborEmployment.averageAnnualIncome = Math.round(core.gdpPerCapita * 0.8);
  const taxRevenue = (core.nominalGDP * (fiscalSystem.taxRevenueGDPPercent || 20)) / 100;
  fiscalSystem.governmentRevenueTotal = taxRevenue;
  fiscalSystem.taxRevenuePerCapita = taxRevenue / core.totalPopulation;

  return { inputs, population, nominalGdp };
}

/** The builder state a wiki infobox import starts the new nation from. */
export function buildWikiImportState(wiki: WikiImportPayload): Partial<BuilderState> {
  const { inputs, population, nominalGdp } = buildEconomicInputs(wiki);
  const core = inputs.coreIndicators;
  const components = wiki._importResult?.selectedComponents ?? [];
  const hasGovernment = !!(wiki.government_type || wiki.head_of_state);
  const hasEconomy = !!(population || nominalGdp);
  return {
    creationOrigin: "import",
    step: "core",
    economicInputs: inputs,
    completedSteps: ["foundation"],
    ...(hasGovernment && { governmentStructure: buildGovernmentStructure(wiki, core.nominalGDP) }),
    ...(hasEconomy && {
      economyBuilderState: buildEconomyState(
        wiki,
        population ?? 10000000,
        nominalGdp ?? core.totalPopulation * core.gdpPerCapita
      ),
    }),
    ...(components.length > 0 && { governmentComponents: components }),
  };
}
