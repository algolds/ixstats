import { normalizeFlagUrl } from "~/lib/flags/normalization";
import type { RouterOutputs } from "~/trpc/react";
import type { CountryWithEditorFields } from "~/types/country-editor";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type {
  DepartmentCategory,
  DepartmentInput,
  GovernmentBuilderState,
  GovernmentType,
  KeyPerformanceIndicator,
  OrganizationalLevel,
  RevenueCategory,
} from "~/types/government";
import type {
  AgeGroup,
  EconomicClass,
  EconomicInputs,
  EducationLevel,
  NationalIdentityData,
  Region,
} from "~/types/builder";
import type { EconomicComponentType } from "~/lib/economy/atomic-data";
import { createDefaultEconomyBuilderState } from "../components/enhanced/economy-builder/economyStateUtils";
import type { SpendingCategoryData } from "../utils/governmentValidation";
import { createDefaultEconomicInputs } from "./economy-data-service";

type RawJsonValue =
  | string
  | number
  | boolean
  | null
  | Record<string, string | number | boolean | null>
  | Array<Record<string, string | number | boolean | null>>;

export interface EditorRelationsData {
  demographics?: {
    ageDistribution?: RawJsonValue;
    educationLevels?: RawJsonValue;
    regions?: RawJsonValue;
  } | null;
  incomeDistribution?: { economicClasses?: RawJsonValue } | null;
  governmentBudget?: { spendingCategories?: RawJsonValue } | null;
  governmentComponents?: Array<{ componentType: string }>;
  economicComponents?: Array<{ componentType: string }>;
  economicProfile?: { sectorBreakdown?: string | null } | null;
}

type ExistingGovernment = NonNullable<RouterOutputs["government"]["getByCountryId"]>;
type StoredIdentity = Partial<NationalIdentityData> & { flagUrl?: string; coatOfArmsUrl?: string };

const REVENUE_CATEGORIES: Record<string, RevenueCategory> = {
  "Direct Tax": "Direct Tax",
  "Indirect Tax": "Indirect Tax",
  "Non-Tax Revenue": "Non-Tax Revenue",
  "Fees and Fines": "Fees and Fines",
  Other: "Other",
  Tax: "Direct Tax",
  Fee: "Fees and Fines",
  Grant: "Non-Tax Revenue",
  Resource: "Non-Tax Revenue",
  Enterprise: "Non-Tax Revenue",
};

const toRevenueCategory = (cat: string | null | undefined): RevenueCategory =>
  REVENUE_CATEGORIES[cat ?? ""] ?? "Other";

/** Free-text identity fields that hydrate to "" when the stored identity lacks them. */
const IDENTITY_TEXT_FIELDS = [
  "countryName",
  "governmentType",
  "currency",
  "currencySymbol",
  "nationalReligion",
  "isoCode",
  "weekStartDay",
  "officialName",
  "motto",
  "mottoNative",
  "capitalCity",
  "largestCity",
  "demonym",
  "officialLanguages",
  "nationalLanguage",
  "nationalAnthem",
  "nationalDay",
  "callingCode",
  "internetTLD",
  "timeZone",
  "coordinatesLatitude",
  "coordinatesLongitude",
  "emergencyNumber",
  "postalCodeFormat",
  "nationalSport",
  "nationalAnimal",
  "nationalBird",
  "nationalFish",
  "founders",
  "nationalFlower",
  "nationalDish",
  "nationalFruit",
  "nationalDrink",
  "nationalInstrument",
  "nationalSymbol",
  "nationalAnimalImage",
  "nationalBirdImage",
  "nationalFishImage",
  "foundersImage",
  "nationalFlowerImage",
  "nationalDishImage",
  "nationalFruitImage",
  "nationalDrinkImage",
  "nationalInstrumentImage",
  "nationalSymbolImage",
] as const satisfies readonly (keyof NationalIdentityData)[];

const LABOR_FIELDS = [
  "unemploymentRate",
  "laborForceParticipationRate",
  "employmentRate",
  "totalWorkforce",
  "averageWorkweekHours",
  "minimumWage",
  "averageAnnualIncome",
] as const;

const FISCAL_FIELDS = [
  "taxRevenueGDPPercent",
  "governmentRevenueTotal",
  "totalDebtGDPRatio",
  "budgetDeficitSurplus",
  "governmentBudgetGDPPercent",
  "internalDebtGDPPercent",
  "externalDebtGDPPercent",
  "interestRates",
  "debtServiceCosts",
] as const;

const INCOME_FIELDS = ["povertyRate", "incomeInequalityGini", "socialMobilityIndex"] as const;

/** The country's numeric columns for `keys`, with missing values as 0. */
function numbersFrom<K extends keyof CountryWithEditorFields>(
  country: CountryWithEditorFields,
  keys: readonly K[]
): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, country[key] ?? 0])) as Record<K, number>;
}

function parseJsonArray<T>(value: RawJsonValue | undefined): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function buildNationalIdentity(
  country: CountryWithEditorFields,
  stored: StoredIdentity | undefined
): NationalIdentityData {
  const fallbacks: Partial<Record<keyof NationalIdentityData, string>> = {
    countryName: country.name,
    governmentType: country.governmentType || "republic",
    currency: country.currencyName,
    currencySymbol: country.currencySymbol || "$",
    nationalReligion: country.religion,
    isoCode: country.countryCode,
    weekStartDay: "monday",
  };
  const text = Object.fromEntries(
    IDENTITY_TEXT_FIELDS.map((key) => [key, stored?.[key] || fallbacks[key] || ""])
  ) as Pick<NationalIdentityData, (typeof IDENTITY_TEXT_FIELDS)[number]>;

  return { ...text, drivingSide: stored?.drivingSide === "left" ? "left" : "right" };
}

function resolveBaseline(country: CountryWithEditorFields) {
  const stats = country.calculatedStats;
  const population =
    Number(stats?.currentPopulation) || Number(country.baselinePopulation) || 10000000;
  const gdpPerCapita =
    Number(stats?.currentGdpPerCapita) || Number(country.baselineGdpPerCapita) || 25000;
  const totalGdp = Number(stats?.currentTotalGdp) || population * gdpPerCapita;
  return { population, gdpPerCapita, totalGdp };
}

function applyStoredRelations(inputs: EconomicInputs, relations: EditorRelationsData | undefined) {
  const setIfAny = <T>(target: object, key: string, items: T[]) => {
    if (items.length) Reflect.set(target, key, items);
  };
  const demographics = relations?.demographics;
  setIfAny(
    inputs.demographics,
    "ageDistribution",
    parseJsonArray<AgeGroup>(demographics?.ageDistribution)
  );
  setIfAny(
    inputs.demographics,
    "educationLevels",
    parseJsonArray<EducationLevel>(demographics?.educationLevels)
  );
  setIfAny(inputs.demographics, "regions", parseJsonArray<Region>(demographics?.regions));
  setIfAny(
    inputs.incomeWealth,
    "economicClasses",
    parseJsonArray<EconomicClass>(relations?.incomeDistribution?.economicClasses)
  );
  setIfAny(
    inputs.governmentSpending,
    "spendingCategories",
    parseJsonArray<SpendingCategoryData>(relations?.governmentBudget?.spendingCategories)
  );
}

/** The economic inputs the editor starts from: the live country, plus its stored relations. */
export function hydrateEconomicInputs(
  country: CountryWithEditorFields,
  relations: EditorRelationsData | undefined
): EconomicInputs {
  const { population, gdpPerCapita, totalGdp } = resolveBaseline(country);
  const inputs = createDefaultEconomicInputs({
    name: country.name,
    countryCode: country.countryCode || "us",
    population,
    gdpPerCapita,
    gdp: totalGdp,
    unemploymentRate: country.unemploymentRate ?? 5,
    taxRevenuePercent: country.taxRevenueGDPPercent ?? 20,
  });

  inputs.countryName = country.name;
  inputs.coreIndicators = {
    totalPopulation: population,
    gdpPerCapita,
    nominalGDP: totalGdp,
    realGDPGrowthRate: country.realGDPGrowthRate ?? 0,
    inflationRate: country.inflationRate ?? 0,
    currencyExchangeRate: country.currencyExchangeRate ?? 1.0,
  };
  Object.assign(inputs.laborEmployment, numbersFrom(country, LABOR_FIELDS));
  Object.assign(inputs.fiscalSystem, numbersFrom(country, FISCAL_FIELDS));
  Object.assign(inputs.incomeWealth, numbersFrom(country, INCOME_FIELDS));
  Object.assign(inputs.demographics, numbersFrom(country, ["lifeExpectancy", "literacyRate"]));
  const urbanPercent = country.urbanPopulationPercent ?? 65;
  inputs.demographics.urbanRuralSplit = { urban: urbanPercent, rural: 100 - urbanPercent };
  Object.assign(inputs.governmentSpending, {
    totalSpending: country.totalGovernmentSpending ?? 0,
    spendingGDPPercent: country.spendingGDPPercent ?? 0,
    spendingPerCapita: country.spendingPerCapita ?? 0,
    deficitSurplus: country.budgetDeficitSurplus ?? 0,
  });

  const stored = country.nationalIdentity as StoredIdentity | undefined;
  inputs.nationalIdentity = buildNationalIdentity(country, stored);
  inputs.flagUrl = normalizeFlagUrl(stored?.flagUrl || country.flag) || "";
  inputs.coatOfArmsUrl = normalizeFlagUrl(stored?.coatOfArmsUrl || country.coatOfArms) || "";
  inputs.geography = { continent: country.continent || "", region: country.region || "" };
  applyStoredRelations(inputs, relations);
  return inputs;
}

/** The economy builder state, or null when the country has no stored economy to hydrate. */
export function hydrateEconomyBuilderState(
  inputs: EconomicInputs,
  relations: EditorRelationsData | undefined
): EconomyBuilderState | null {
  const components = relations?.economicComponents ?? [];
  let structure: EconomyBuilderState["structure"] | null = null;
  try {
    const breakdown = relations?.economicProfile?.sectorBreakdown;
    if (breakdown) structure = JSON.parse(breakdown);
  } catch {
    structure = null;
  }
  if (!components.length && !structure) return null;

  const state = createDefaultEconomyBuilderState(inputs);
  return {
    ...state,
    structure: { ...state.structure, ...structure },
    selectedAtomicComponents: components.map((c) => c.componentType as EconomicComponentType),
    isValid: true,
    errors: {},
    lastUpdated: new Date(),
    version: "1.0.0",
  };
}

const emptyGovernmentErrors = () => ({ structure: [], departments: {}, budget: [], revenue: [] });

/** The government builder state: the saved government, or a blank one for a country without. */
export function hydrateGovernmentStructure(
  country: CountryWithEditorFields,
  government: ExistingGovernment | null | undefined,
  totalGdp: number
): GovernmentBuilderState {
  if (!government) {
    return {
      structure: {
        governmentName: `Government of ${country.name}`,
        governmentType: (country.governmentType || "Other") as GovernmentType,
        headOfState: "",
        headOfGovernment: "",
        legislatureName: "",
        executiveName: "",
        judicialName: "",
        totalBudget: totalGdp * 0.35,
        fiscalYear: "Calendar Year",
        budgetCurrency: country.currencyName || "USD",
      },
      departments: [],
      budgetAllocations: [],
      revenueSources: [],
      isValid: true,
      errors: emptyGovernmentErrors(),
    };
  }

  return {
    structure: {
      governmentName: government.governmentName,
      governmentType: government.governmentType as GovernmentType,
      headOfState: government.headOfState ?? undefined,
      headOfGovernment: government.headOfGovernment ?? undefined,
      legislatureName: government.legislatureName ?? undefined,
      executiveName: government.executiveName ?? undefined,
      judicialName: government.judicialName ?? undefined,
      // Always present here: the builder only edits a nation the caller may write to.
      totalBudget: government.totalBudget ?? 0,
      fiscalYear: government.fiscalYear,
      budgetCurrency: government.budgetCurrency,
    },
    departments: government.departments.map(
      (dept) =>
        ({
          name: dept.name,
          shortName: dept.shortName ?? undefined,
          category: dept.category as DepartmentCategory,
          description: dept.description ?? undefined,
          minister: dept.minister ?? undefined,
          ministerTitle: dept.ministerTitle || "",
          headquarters: dept.headquarters ?? undefined,
          established: dept.established ?? undefined,
          employeeCount: dept.employeeCount ?? undefined,
          icon: dept.icon ?? undefined,
          color: dept.color ?? undefined,
          priority: dept.priority ?? undefined,
          parentDepartmentId: dept.parentDepartmentId ?? undefined,
          organizationalLevel: (dept.organizationalLevel || "Department") as OrganizationalLevel,
          functions: parseJsonArray<string>(dept.functions),
          kpis: parseJsonArray<KeyPerformanceIndicator>(dept.kpis),
        }) as DepartmentInput
    ),
    budgetAllocations: government.budgetAllocations.map((alloc) => ({
      departmentId: alloc.departmentId,
      budgetYear: alloc.budgetYear,
      allocatedAmount: alloc.allocatedAmount,
      allocatedPercent: alloc.allocatedPercent,
      notes: alloc.notes ?? undefined,
    })),
    revenueSources: government.revenueSources.map((rev) => ({
      name: rev.name,
      category: toRevenueCategory(rev.category),
      description: rev.description ?? undefined,
      rate: rev.rate ?? undefined,
      revenueAmount: rev.revenueAmount,
      revenuePercent: rev.revenuePercent ?? undefined,
      collectionMethod: rev.collectionMethod ?? undefined,
      administeredBy: rev.administeredBy ?? undefined,
    })),
    isValid: true,
    errors: emptyGovernmentErrors(),
  };
}
