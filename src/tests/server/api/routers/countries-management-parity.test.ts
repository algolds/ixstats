/** @jest-environment node */
/**
 * The table-driven createCountry / updateCountry field mapping must write exactly what the original
 * hand-written mapping wrote: same keys, same fallbacks, 0 / "" handled the same way. The `old*` functions
 * below are the pre-refactor mapping, kept as the reference.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({
  ...jest.requireActual("~/lib/auth"),
  isSystemOwner: () => false,
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/layer-cache", () => ({ clearLayerCache: jest.fn() }));
jest.mock("~/lib/vault/vault-bonus", () => ({
  getBonusConfig: jest.fn().mockResolvedValue({ newPlayer: 0, wikiImport: 0 }),
  grantBonus: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/country-mutation-helpers", () => ({
  syncNationalIdentity: jest.fn(),
  syncDemographics: jest.fn(),
  syncIncomeAndSpending: jest.fn(),
  syncTaxSystem: jest.fn(),
  syncGovernmentStructure: jest.fn(),
  syncGovernmentComponents: jest.fn(),
  syncEconomyBuilderState: jest.fn(),
}));

import { createTRPCRouter } from "~/server/api/trpc";
import { managementCreateProcedures } from "~/server/api/routers/countries/management/create";
import { managementUpdateProcedures } from "~/server/api/routers/countries/management/update";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const CLERK_ID = "clerk_p1";

// Each case supplies a zero where the old code treated it specially (0 kept vs 0 falling back).
const FULL_INPUT = {
  coreIndicators: {
    totalPopulation: 5_000_000,
    gdpPerCapita: 30_000,
    nominalGDP: 150_000_000_000,
    realGDPGrowthRate: 0,
    inflationRate: 0,
    currencyExchangeRate: 0,
  },
  laborEmployment: {
    laborForceParticipationRate: 0,
    unemploymentRate: 0,
    totalWorkforce: 0,
    employmentRate: 0,
    averageWorkweekHours: 0,
    minimumWage: 0,
    averageAnnualIncome: 0,
  },
  fiscalSystem: {
    taxRevenueGDPPercent: 0,
    governmentRevenueTotal: 0,
    taxRevenuePerCapita: 0,
    governmentBudgetGDPPercent: 0,
    budgetDeficitSurplus: 0,
    internalDebtGDPPercent: 0,
    externalDebtGDPPercent: 0,
    totalDebtGDPRatio: 0,
    debtPerCapita: 0,
    interestRates: 0,
    debtServiceCosts: 0,
  },
  demographics: {
    populationGrowthRate: 0,
    lifeExpectancy: 0,
    literacyRate: 0,
    urbanRuralSplit: { urban: 0, rural: 0 },
  },
  incomeWealth: { povertyRate: 0, incomeInequalityGini: 0, socialMobilityIndex: 0 },
  governmentSpending: { totalSpending: 0, spendingGDPPercent: 0, spendingPerCapita: 0 },
  geography: { continent: "Aurelia", region: "North" },
  nationalIdentity: { governmentType: "", nationalReligion: "", leader: "" },
  flagUrl: "",
  coatOfArmsUrl: "",
};

const SPARSE_INPUT = {
  coreIndicators: { totalPopulation: 0, gdpPerCapita: 0, nominalGDP: 0, realGDPGrowthRate: 4 },
  fiscalSystem: {},
  incomeWealth: { giniIndex: 40 },
  geography: { continent: "" },
  nationalIdentity: { leader: "Chancellor", governmentType: "Republic" },
  flagUrl: "flag.svg",
};

const POPULATED_INPUT = {
  coreIndicators: {
    totalPopulation: 8_000_000,
    gdpPerCapita: 41_000,
    nominalGDP: 328_000_000_000,
    realGDPGrowthRate: 3.5,
    inflationRate: 2.25,
    currencyExchangeRate: 1.7,
  },
  laborEmployment: {
    laborForceParticipationRate: 61,
    unemploymentRate: 4.5,
    totalWorkforce: 3_000_000,
    employmentRate: 93,
    averageWorkweekHours: 37,
    minimumWage: 12,
    averageAnnualIncome: 30_000,
  },
  fiscalSystem: {
    taxRevenueGDPPercent: 31,
    governmentRevenueTotal: 9,
    taxRevenuePerCapita: 8,
    governmentBudgetGDPPercent: 7,
    budgetDeficitSurplus: -6,
    internalDebtGDPPercent: 5,
    externalDebtGDPPercent: 4,
    totalDebtGDPRatio: 3,
    debtPerCapita: 2,
    interestRates: 1.5,
    debtServiceCosts: 0.5,
  },
  demographics: {
    populationGrowthRate: 1.1,
    lifeExpectancy: 80,
    literacyRate: 99,
    urbanRuralSplit: { urban: 70, rural: 30 },
  },
  incomeWealth: { povertyRate: 9, incomeInequalityGini: 0.31, socialMobilityIndex: 55 },
  governmentSpending: { totalSpending: 11, spendingGDPPercent: 22, spendingPerCapita: 33 },
  geography: { continent: "Boreas", region: "East" },
  nationalIdentity: { governmentType: "Monarchy", nationalReligion: "Sun", leader: "Queen" },
  flagUrl: "f.svg",
  coatOfArmsUrl: "c.svg",
};

type Econ = Record<string, any>;

const pct = (v: number | undefined) => (v !== undefined ? v / 100 : undefined);

/** Pre-refactor createCountry column mapping (numbers and text), verbatim in behaviour. */
function oldCreateData(econ: Econ, taxRate: number | undefined, structureType: string | undefined) {
  const core = econ.coreIndicators || {};
  const labor = econ.laborEmployment || {};
  const fiscal = econ.fiscalSystem || {};
  const demo = econ.demographics || {};
  const income = econ.incomeWealth || {};
  const spending = econ.governmentSpending || {};
  const identity = econ.nationalIdentity || {};
  const geo = econ.geography || {};
  const population = core.totalPopulation || 10000000;
  const gdpPerCapita = core.gdpPerCapita || 25000;
  const nominalGDP = core.nominalGDP || population * gdpPerCapita;
  return {
    continent: geo.continent || "Custom",
    region: geo.region || "Custom",
    governmentType: identity.governmentType || structureType || "Federal Republic",
    religion: identity.nationalReligion || "Secular",
    leader: identity.leader || "President",
    flag: econ.flagUrl || undefined,
    coatOfArms: econ.coatOfArmsUrl || undefined,
    baselinePopulation: population,
    baselineGdpPerCapita: gdpPerCapita,
    currentPopulation: population,
    currentGdpPerCapita: gdpPerCapita,
    currentTotalGdp: population * gdpPerCapita,
    adjustedGdpGrowth: core.realGDPGrowthRate !== undefined ? core.realGDPGrowthRate / 100 : 0.025,
    populationGrowthRate:
      demo.populationGrowthRate !== undefined ? demo.populationGrowthRate / 100 : 0.008,
    actualGdpGrowth: core.realGDPGrowthRate !== undefined ? core.realGDPGrowthRate / 100 : 0.025,
    nominalGDP,
    realGDPGrowthRate: core.realGDPGrowthRate !== undefined ? core.realGDPGrowthRate / 100 : 0.025,
    maxGdpGrowthRate: 0.15,
    inflationRate: core.inflationRate !== undefined ? core.inflationRate / 100 : 0.02,
    currencyExchangeRate: core.currencyExchangeRate || 1.0,
    laborForceParticipationRate: labor.laborForceParticipationRate || 65,
    employmentRate: labor.employmentRate || 95,
    unemploymentRate: labor.unemploymentRate || 5,
    totalWorkforce: labor.totalWorkforce || Math.round(population * 0.65),
    averageWorkweekHours: labor.averageWorkweekHours || 40,
    minimumWage: labor.minimumWage || 15,
    averageAnnualIncome: labor.averageAnnualIncome || gdpPerCapita * 0.8,
    taxRevenueGDPPercent: fiscal.taxRevenueGDPPercent || taxRate || 25,
    governmentRevenueTotal: fiscal.governmentRevenueTotal || nominalGDP * 0.25,
    taxRevenuePerCapita: fiscal.taxRevenuePerCapita || (nominalGDP * 0.25) / population,
    governmentBudgetGDPPercent: fiscal.governmentBudgetGDPPercent || 25,
    budgetDeficitSurplus: fiscal.budgetDeficitSurplus || 0,
    internalDebtGDPPercent: fiscal.internalDebtGDPPercent || 30,
    externalDebtGDPPercent: fiscal.externalDebtGDPPercent || 20,
    totalDebtGDPRatio: fiscal.totalDebtGDPRatio || 50,
    debtPerCapita: fiscal.debtPerCapita || (nominalGDP * 0.5) / population,
    interestRates: fiscal.interestRates || 3.5,
    debtServiceCosts: fiscal.debtServiceCosts || nominalGDP * 0.02,
    povertyRate: income.povertyRate || 12,
    incomeInequalityGini:
      income.incomeInequalityGini || (income.giniIndex ? income.giniIndex / 100 : 0.35),
    socialMobilityIndex: income.socialMobilityIndex || 65,
    totalGovernmentSpending: spending.totalSpending || nominalGDP * 0.22,
    spendingGDPPercent: spending.spendingGDPPercent || 22,
    spendingPerCapita: spending.spendingPerCapita || (nominalGDP * 0.22) / population,
    lifeExpectancy: demo.lifeExpectancy || 78.5,
    urbanPopulationPercent: demo.urbanRuralSplit?.urban || 65,
    ruralPopulationPercent: demo.urbanRuralSplit?.rural || 35,
    literacyRate: demo.literacyRate || 95,
  };
}

const EXISTING = {
  id: "c1",
  name: "Old Name",
  baselinePopulation: 7_000_000,
  baselineGdpPerCapita: 20_000,
  continent: "OldContinent",
  region: "OldRegion",
  governmentType: "OldGov",
  religion: "OldReligion",
  leader: "OldLeader",
  flag: "old-flag.svg",
  coatOfArms: "old-coa.svg",
  adjustedGdpGrowth: 101,
  actualGdpGrowth: 102,
  realGDPGrowthRate: 103,
  inflationRate: 104,
  currencyExchangeRate: 105,
  populationGrowthRate: 106,
  lifeExpectancy: 107,
  urbanPopulationPercent: 108,
  ruralPopulationPercent: 109,
  literacyRate: 110,
  laborForceParticipationRate: 111,
  employmentRate: 112,
  unemploymentRate: 113,
  averageWorkweekHours: 114,
  minimumWage: 115,
  averageAnnualIncome: 116,
  taxRevenueGDPPercent: 117,
  governmentRevenueTotal: 118,
  taxRevenuePerCapita: 119,
  governmentBudgetGDPPercent: 120,
  budgetDeficitSurplus: 121,
  internalDebtGDPPercent: 122,
  externalDebtGDPPercent: 123,
  totalDebtGDPRatio: 124,
  debtPerCapita: 125,
  interestRates: 126,
  debtServiceCosts: 127,
  povertyRate: 128,
  incomeInequalityGini: 129,
  socialMobilityIndex: 130,
  totalGovernmentSpending: 131,
  spendingGDPPercent: 132,
  spendingPerCapita: 133,
};

/** Pre-refactor updateCountry column mapping (the `: undefined`-keeps-stored rule, per field). */
function oldUpdateData(econ: Econ, taxRate: number | undefined, structureType: string | undefined) {
  const core = econ.coreIndicators;
  const labor = econ.laborEmployment;
  const fiscal = econ.fiscalSystem;
  const demo = econ.demographics;
  const income = econ.incomeWealth;
  const spending = econ.governmentSpending;
  const identity = econ.nationalIdentity;
  const geo = econ.geography;
  const e = EXISTING;
  const keep = <T>(v: T | undefined, stored: T) => (v !== undefined ? v : stored);
  return {
    continent: geo?.continent || e.continent,
    region: geo?.region || e.region,
    governmentType: identity?.governmentType || structureType || e.governmentType,
    religion: identity?.nationalReligion || e.religion,
    leader: identity?.leader || e.leader,
    flag: econ.flagUrl || e.flag || undefined,
    coatOfArms: econ.coatOfArmsUrl || e.coatOfArms || undefined,
    adjustedGdpGrowth: keep(pct(core?.realGDPGrowthRate), e.adjustedGdpGrowth),
    populationGrowthRate: keep(pct(demo?.populationGrowthRate), e.populationGrowthRate),
    actualGdpGrowth: keep(pct(core?.realGDPGrowthRate), e.actualGdpGrowth),
    realGDPGrowthRate: keep(pct(core?.realGDPGrowthRate), e.realGDPGrowthRate),
    inflationRate: keep(pct(core?.inflationRate), e.inflationRate),
    currencyExchangeRate: keep(core?.currencyExchangeRate, e.currencyExchangeRate),
    laborForceParticipationRate: keep(
      labor?.laborForceParticipationRate,
      e.laborForceParticipationRate
    ),
    employmentRate: keep(labor?.employmentRate, e.employmentRate),
    unemploymentRate: keep(labor?.unemploymentRate, e.unemploymentRate),
    averageWorkweekHours: keep(labor?.averageWorkweekHours, e.averageWorkweekHours),
    minimumWage: keep(labor?.minimumWage, e.minimumWage),
    averageAnnualIncome: keep(labor?.averageAnnualIncome, e.averageAnnualIncome),
    taxRevenueGDPPercent: keep(fiscal?.taxRevenueGDPPercent ?? taxRate, e.taxRevenueGDPPercent),
    governmentRevenueTotal: keep(fiscal?.governmentRevenueTotal, e.governmentRevenueTotal),
    taxRevenuePerCapita: keep(fiscal?.taxRevenuePerCapita, e.taxRevenuePerCapita),
    governmentBudgetGDPPercent: keep(
      fiscal?.governmentBudgetGDPPercent,
      e.governmentBudgetGDPPercent
    ),
    budgetDeficitSurplus: keep(fiscal?.budgetDeficitSurplus, e.budgetDeficitSurplus),
    internalDebtGDPPercent: keep(fiscal?.internalDebtGDPPercent, e.internalDebtGDPPercent),
    externalDebtGDPPercent: keep(fiscal?.externalDebtGDPPercent, e.externalDebtGDPPercent),
    totalDebtGDPRatio: keep(fiscal?.totalDebtGDPRatio, e.totalDebtGDPRatio),
    debtPerCapita: keep(fiscal?.debtPerCapita, e.debtPerCapita),
    interestRates: keep(fiscal?.interestRates, e.interestRates),
    debtServiceCosts: keep(fiscal?.debtServiceCosts, e.debtServiceCosts),
    povertyRate: keep(income?.povertyRate, e.povertyRate),
    incomeInequalityGini: keep(
      income?.incomeInequalityGini ?? pct(income?.giniIndex),
      e.incomeInequalityGini
    ),
    socialMobilityIndex: keep(income?.socialMobilityIndex, e.socialMobilityIndex),
    totalGovernmentSpending: keep(spending?.totalSpending, e.totalGovernmentSpending),
    spendingGDPPercent: keep(spending?.spendingGDPPercent, e.spendingGDPPercent),
    spendingPerCapita: keep(spending?.spendingPerCapita, e.spendingPerCapita),
    lifeExpectancy: keep(demo?.lifeExpectancy, e.lifeExpectancy),
    urbanPopulationPercent: keep(demo?.urbanRuralSplit?.urban, e.urbanPopulationPercent),
    ruralPopulationPercent: keep(demo?.urbanRuralSplit?.rural, e.ruralPopulationPercent),
    literacyRate: keep(demo?.literacyRate, e.literacyRate),
  };
}

const withoutUndefined = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function makeCtx(db: any) {
  return createMockRouterContext({
    db,
    auth: { userId: CLERK_ID },
    user: { id: "u1", clerkUserId: CLERK_ID, countryId: "c1", role: { name: "user" } },
  });
}

const CASES: Array<[string, Econ]> = [
  ["zeros everywhere", FULL_INPUT],
  ["sparse", SPARSE_INPUT],
  ["populated", POPULATED_INPUT],
  ["empty", {}],
];

describe("countries.updateCountry field mapping matches the pre-refactor mapping", () => {
  const router = createTRPCRouter(managementUpdateProcedures);

  it.each(CASES)("%s", async (_label, econ) => {
    const update = jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "c1", ...data }));
    const db: any = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(db)),
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      country: { findUnique: jest.fn().mockResolvedValue(EXISTING), update },
    };
    const caller = router.createCaller(makeCtx(db) as never);

    await caller.updateCountry({
      id: "c1",
      name: "New Name",
      economicInputs: econ,
      taxSystemData: { taxSystemName: "T", totalTaxRate: 33 },
      governmentStructure: { governmentName: "G", governmentType: "Federation" },
    } as never);

    const written = update.mock.calls[0]![0].data as Record<string, unknown>;
    const expected = oldUpdateData(econ, 33, "Federation");
    for (const [key, value] of Object.entries(expected)) {
      expect({ key, value: written[key] }).toEqual({ key, value });
    }
    // No stray columns beyond the old mapping plus the derived/baseline ones.
    const derived = new Set([
      "name",
      "slug",
      "baselinePopulation",
      "baselineGdpPerCapita",
      "currentPopulation",
      "currentGdpPerCapita",
      "currentTotalGdp",
      "economicTier",
      "populationTier",
      "nominalGDP",
      "totalWorkforce",
      "lastCalculated",
    ]);
    const extra = Object.keys(withoutUndefined(written)).filter(
      (k) => !(k in expected) && !derived.has(k)
    );
    expect(extra).toEqual([]);
  });
});

describe("countries.createCountry field mapping matches the pre-refactor mapping", () => {
  const router = createTRPCRouter(managementCreateProcedures);

  it.each(CASES)("%s", async (_label, econ) => {
    const create = jest.fn(({ data }: { data: { realmId?: string | null } }) =>
      Promise.resolve({ id: "c_new", ...data })
    );
    const db: any = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(db)),
      user: {
        findUnique: jest.fn(({ where }: { where: { clerkUserId?: string } }) =>
          Promise.resolve(
            where.clerkUserId
              ? { id: "u1", clerkUserId: CLERK_ID, roleId: "r", role: { name: "user" } }
              : { membershipTier: "basic", country: null }
          )
        ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      realm: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id, status: "active", settings: null })
        ),
      },
      country: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(({ where }: { where: { slug?: string } }) =>
          where.slug
            ? Promise.resolve(null)
            : Promise.resolve({
                id: "c_new",
                realmId: create.mock.calls[0]?.[0].data.realmId,
                ownerUserId: null,
                realm: { settings: null },
              })
        ),
        create,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const caller = router.createCaller(makeCtx(db) as never);

    await caller.createCountry({
      name: "New Aurelia",
      foundationCountry: null,
      economicInputs: econ,
      taxSystemData: { taxSystemName: "T", totalTaxRate: 33 },
      governmentStructure: { governmentName: "G", governmentType: "Federation" },
    } as never);

    const written = create.mock.calls[0]![0].data as Record<string, unknown>;
    const expected = oldCreateData(econ, 33, "Federation");
    for (const [key, value] of Object.entries(expected)) {
      expect({ key, value: written[key] }).toEqual({ key, value });
    }
    const derived = new Set([
      "name",
      "slug",
      "realmId",
      "economicTier",
      "populationTier",
      "baselineDate",
      "lastCalculated",
      "landArea",
      "areaSqMi",
      "populationDensity",
      "gdpDensity",
    ]);
    const extra = Object.keys(withoutUndefined(written)).filter(
      (k) => !(k in expected) && !derived.has(k)
    );
    expect(extra).toEqual([]);
  });
});
