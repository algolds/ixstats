/** @jest-environment node */
/**
 * countries.previewFounding returns the figures of the nation createCountry would found from the
 * same draft (spec §2: the nation card can never drift from the founded nation), and writes
 * nothing.
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
jest.mock("~/lib/vault/vault-bonus", () => ({
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

import type { EconomicArchetype } from "@prisma/client";
import { createTRPCRouter } from "~/server/api/trpc";
import { managementCreateProcedures } from "~/server/api/routers/countries/management/create";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import {
  syncEconomyBuilderState,
  syncGovernmentComponents,
  syncGovernmentStructure,
  syncTaxSystem,
} from "~/server/shared/country-mutation-helpers";
import { buildArchetypeSeedRows } from "~/lib/economy/archetypes/seed";
import {
  estimateTaxRevenuePercent,
  foundingExpectedGrowth,
  foundingGovernmentEffectiveness,
  foundingStability,
  type FoundedCountryFigures,
} from "~/server/shared/founding-snapshot";

const router = createTRPCRouter(managementCreateProcedures);
const CLERK_ID = "clerk_p1";

const NORDIC = (() => {
  const row = buildArchetypeSeedRows().find((r) => r.key === "nordic")!;
  return { ...row, id: "arch_nordic", usageCount: 0, createdBy: null } as EconomicArchetype;
})();

const FOUNDATION = {
  id: "f1",
  name: "Benchmark",
  slug: "benchmark",
  realmId: "default",
  baselinePopulation: 9_000_000,
  baselineGdpPerCapita: 52_000,
  landArea: 400_000,
  areaSqMi: 154_000,
  continent: "Norda",
  region: "North",
  flag: null,
  coatOfArms: null,
};

function setup() {
  const create = jest.fn(({ data }: { data: object }) => Promise.resolve({ id: "c_new", ...data }));
  const db: any = {
    $transaction: jest.fn(),
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
    realmPage: { findFirst: jest.fn().mockResolvedValue(null) },
    economicArchetype: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === NORDIC.id ? NORDIC : null)
      ),
      findFirst: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === NORDIC.key ? NORDIC : null)
      ),
    },
    country: {
      // Name-taken check (realmId + name) finds nothing; the foundation lookup (OR slug/name) does.
      findFirst: jest.fn(({ where }: { where: { OR?: unknown } }) =>
        Promise.resolve(where.OR ? FOUNDATION : null)
      ),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(({ where }: { where: { slug?: string } }) =>
        where.slug
          ? Promise.resolve(null)
          : Promise.resolve({
              id: "c_new",
              realmId: "default",
              ownerUserId: null,
              realm: { settings: null },
            })
      ),
      create,
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  db.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(db));
  const ctx = createMockRouterContext({
    db,
    auth: { userId: CLERK_ID },
    user: { id: "u1", clerkUserId: CLERK_ID, countryId: null, role: { name: "user" } },
  });
  return { db, create, caller: router.createCaller(ctx as never) };
}

const DRAFTS = [
  [
    "archetype with bands and a form",
    {
      archetypeId: NORDIC.key,
      populationBand: "medium",
      wealthBand: "very-wealthy",
      governmentFormId: "constitutional-monarchy",
    },
  ],
  [
    "foundation with an exact population and inferred form",
    {
      foundationCountry: "benchmark",
      archetypeId: NORDIC.id,
      economicInputs: {
        coreIndicators: { totalPopulation: 8_400_000, gdpPerCapita: 0, nominalGDP: 0 },
      },
    },
  ],
  ["blank", {}],
] as const;

describe("countries.previewFounding", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(DRAFTS)("%s: preview equals what createCountry writes", async (_label, draft) => {
    const { db, create, caller } = setup();
    const preview = await caller.previewFounding({ name: "New Aurelia", ...draft } as never);
    expect(create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();

    await caller.createCountry({
      name: "New Aurelia",
      foundationCountry: null,
      economicInputs: {},
      ...draft,
    } as never);

    const written = create.mock.calls[0]![0].data as unknown as FoundedCountryFigures & {
      nominalGDP: number;
      governmentRevenueTotal: number;
      governmentType: string;
    };
    const structure = jest.mocked(syncGovernmentStructure).mock.calls[0]![3] as {
      totalBudget: number;
      governmentType: string;
    };
    const components = jest.mocked(syncGovernmentComponents).mock.calls[0]![2] as Array<{
      componentType: string;
    }>;
    const economy = jest.mocked(syncEconomyBuilderState).mock.calls[0]![2] as {
      selectedAtomicComponents: string[];
    };
    const tax = jest.mocked(syncTaxSystem).mock.calls[0]![2];

    expect(preview.gdp).toBe(written.nominalGDP);
    expect(preview.gdpPerCapita).toBe(written.currentGdpPerCapita);
    expect(preview.population).toBe(written.currentPopulation);
    expect(preview.budgetBalancePercentOfGdp).toBeCloseTo(
      ((written.governmentRevenueTotal - structure.totalBudget) / written.nominalGDP) * 100,
      2
    );
    expect(preview.budgetBalanceLabel).toBe("Balanced");
    expect(estimateTaxRevenuePercent(tax)).toBeCloseTo(
      (structure.totalBudget / written.nominalGDP) * 100,
      0
    );
    expect(preview.stability).toBe(foundingStability(written));
    expect(preview.governmentEffectiveness).toBeCloseTo(
      foundingGovernmentEffectiveness(components as never),
      2
    );
    expect(preview.expectedGrowth).toBe(
      foundingExpectedGrowth(
        written,
        components.map((c) => c.componentType),
        economy.selectedAtomicComponents
      )
    );
    // The government type comes from the form, never the archetype's name.
    expect(written.governmentType).toBe(structure.governmentType);
    expect(written.governmentType).not.toBe(NORDIC.name);
    for (const value of Object.values(preview)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("an unnamed draft still previews", async () => {
    const { caller } = setup();
    const preview = await caller.previewFounding({ wealthBand: "developing" } as never);
    expect(preview.gdpPerCapita).toBe(4_000);
    expect(preview.population).toBe(10_000_000);
  });

  it("rejects an unknown band", async () => {
    const { caller } = setup();
    await expect(caller.previewFounding({ wealthBand: "galactic" } as never)).rejects.toThrow();
  });
});
