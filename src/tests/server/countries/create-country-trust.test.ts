/** @jest-environment node */
/**
 * countries.createCountry is the only way in for a founding, and any signed-in player can call it directly. It takes
 * what the founding flow can send and nothing a player could use to found an absurd nation: names follow the rename
 * rules (trimmed, 1-100 characters, unique per realm ignoring case), the size and wealth stay within the editor's
 * limits, the flag is an image address, components are real ones, and the explicit fiscal/tax/government payloads
 * the old builder sent are not taken. Right after the founding, the founder's next request sees the new nation.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
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
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({
  ActivityHooks: { User: { onCountryLink: jest.fn(async () => undefined) } },
}));
const forgetContextUser = jest.fn();
jest.mock("~/server/api/trpc/context", () => ({
  ...jest.requireActual("~/server/api/trpc/context"),
  forgetContextUser: (id: string) => forgetContextUser(id),
}));

import { IxTime } from "~/lib/ixtime";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { managementCreateProcedures } from "~/server/api/routers/countries/management/create";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, asOwner } from "~/tests/helpers/nation-world";

const countries = createCallerFactory(createTRPCRouter(managementCreateProcedures));
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(Date.UTC(2043, 3, 1));
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await db.user.create({ data: { id: "ines", clerkUserId: "ines-clerk", lastSeenAt: new Date() } });
  forgetContextUser.mockClear();
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const caller = () =>
  countries(asOwner(db as never, { id: "ines", clerkUserId: "ines-clerk", countryId: null }));
const found = (extra: Record<string, unknown>) =>
  caller().createCountry({
    name: "Valoria",
    foundationCountry: null,
    realmId: "default",
    economicInputs: {},
    ...extra,
  } as never);

it.each([[""], ["   "], ["Z".repeat(300)], ["!!!"]])("refuses the name %p", async (name) => {
  await expect(found({ name })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(await db.country.count()).toBe(0);
});

it("trims the name and refuses one another nation holds in any case", async () => {
  await found({ name: "Valoria" });
  await db.user.create({ data: { id: "olaf", clerkUserId: "olaf-clerk", lastSeenAt: new Date() } });
  const olaf = countries(
    asOwner(db as never, { id: "olaf", clerkUserId: "olaf-clerk", countryId: null })
  );
  const input = { foundationCountry: null, realmId: "default", economicInputs: {} };
  await expect(olaf.createCountry({ ...input, name: "  vALORIA " } as never)).rejects.toMatchObject(
    {
      code: "CONFLICT",
    }
  );
  const created = await olaf.createCountry({ ...input, name: "  New   Valoria " } as never);
  expect(created.name).toBe("New Valoria");
});

it.each([
  [{ totalPopulation: 1e15, gdpPerCapita: 30000, nominalGDP: 0 }],
  [{ totalPopulation: 1_000_000, gdpPerCapita: 1e9, nominalGDP: 0 }],
  [{ totalPopulation: -5, gdpPerCapita: 30000, nominalGDP: 0 }],
])("refuses a size or wealth outside the limits: %p", async (coreIndicators) => {
  await expect(found({ economicInputs: { coreIndicators } })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("derives total GDP from population and GDP per capita, never from a sent figure", async () => {
  const created = await found({
    economicInputs: {
      coreIndicators: { totalPopulation: 1_000_000, gdpPerCapita: 20_000, nominalGDP: 1 },
    },
  });
  expect(created.nominalGDP).toBe(20_000_000_000);
  expect(created.currentTotalGdp).toBe(20_000_000_000);
});

it("refuses a flag that is not an image address and a component that does not exist", async () => {
  await expect(found({ economicInputs: { flagUrl: "javascript:alert(1)" } })).rejects.toMatchObject(
    {
      code: "BAD_REQUEST",
    }
  );
  await expect(found({ governmentComponents: [{ componentType: "NOPE" }] })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("does not take the old builder's explicit fiscal, labor, tax or budget figures", async () => {
  const created = await found({
    economicInputs: {
      coreIndicators: {
        totalPopulation: 1_000_000,
        gdpPerCapita: 20_000,
        nominalGDP: 0,
        realGDPGrowthRate: 1000,
      },
      fiscalSystem: { taxRevenueGDPPercent: 500, governmentRevenueTotal: -1e300 },
      laborEmployment: { laborForceParticipationRate: 100, unemploymentRate: 100 },
    },
    governmentStructure: { totalBudget: 1e30 },
    taxSystemData: { totalTaxRate: 900 },
  });
  expect(created.taxRevenueGDPPercent).toBeLessThanOrEqual(45);
  expect(created.governmentRevenueTotal).toBeGreaterThan(0);
  expect(created.unemploymentRate).toBeLessThan(100);
  expect(created.adjustedGdpGrowth).toBeLessThan(0.2);
  const structure = await db.governmentStructure.findUniqueOrThrow({
    where: { countryId: created.id },
  });
  expect(structure.totalBudget).toBeLessThan(1e13);
});

it("forgets the founder's cached request context, so the welcome page sees the new nation", async () => {
  await found({});
  expect(forgetContextUser).toHaveBeenCalledWith("ines-clerk");
});
