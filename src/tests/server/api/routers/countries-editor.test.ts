/** @jest-environment node */
/**
 * The country editor's section saves: each patches only its own rows and columns, refuses a stale
 * tab (CONFLICT) before writing anything, and returns the new version. Renaming moves the slug
 * and leaves a redirect behind.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));

import { createTRPCRouter } from "~/server/api/trpc";
import { editorProcedures } from "~/server/api/routers/countries/editor";
import { STALE_EDITOR_MESSAGE } from "~/lib/mycountry/editor-fields";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const LOADED_AT = new Date("2026-10-20T10:00:00.000Z");

type Mock = jest.Mock;
type Model = Record<string, Mock>;

const model = (overrides: Record<string, Mock> = {}): Model => ({
  findUnique: jest.fn().mockResolvedValue(null),
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn(async ({ data }: { data: object }) => ({ id: "created", ...data })),
  createMany: jest.fn().mockResolvedValue({ count: 0 }),
  update: jest.fn(async ({ data }: { data: object }) => ({ id: CALLER_COUNTRY, ...data })),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  upsert: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  ...overrides,
});

const COUNTRY = {
  id: CALLER_COUNTRY,
  name: "Testland",
  slug: "testland",
  realmId: "realm_1",
  ownerUserId: "db_user_caller",
  currentPopulation: 10_000_000,
  totalWorkforce: 6_000_000,
  landArea: 100_000,
};

/** Every table the editor could touch, so a test can assert which ones a save left alone. */
function setup({ stale = false, structure = true }: { stale?: boolean; structure?: boolean } = {}) {
  const db: Record<string, Model | Mock> = {
    country: model({
      findUnique: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id === CALLER_COUNTRY) return COUNTRY;
        if (where.id === FOREIGN_COUNTRY) return { id: FOREIGN_COUNTRY, ownerUserId: "someone" };
        return null;
      }),
      updateMany: jest.fn().mockResolvedValue({ count: stale ? 0 : 1 }),
    }),
    nationalIdentity: model(),
    governmentStructure: model({
      findUnique: jest
        .fn()
        .mockResolvedValue(structure ? { id: "gs_1", governmentEffectiveness: 55 } : null),
    }),
    governmentComponent: model({
      findMany: jest.fn().mockResolvedValue([
        { id: "gc_1", componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 70 },
        { id: "gc_2", componentType: "RULE_OF_LAW", effectivenessScore: 64 },
      ]),
    }),
    componentSynergy: model(),
    governmentDepartment: model(),
    budgetAllocation: model(),
    taxSystem: model(),
    fiscalSystem: model(),
    economicComponent: model(),
    realmPage: model(),
    countrySlugRedirect: model(),
    user: model({
      findUnique: jest.fn().mockResolvedValue({
        id: "db_user_caller",
        clerkUserId: "user_caller",
        countryId: CALLER_COUNTRY,
        role: { name: "member" },
      }),
    }),
  };
  db.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
  const caller = createTRPCRouter(editorProcedures).createCaller(createIdorContext(db as never));
  return { db: db as Record<string, Model> & { $transaction: Mock }, caller };
}

/** The tables a save wrote to (any create, update, upsert or delete). */
function written(db: Record<string, Model | Mock>): string[] {
  const writes = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"];
  return Object.entries(db)
    .filter(([name]) => !name.startsWith("$"))
    .filter(([, m]) => writes.some((op) => ((m as Model)[op]?.mock.calls.length ?? 0) > 0))
    .map(([name]) => name)
    .sort();
}

const base = { countryId: CALLER_COUNTRY, expectedUpdatedAt: LOADED_AT };

beforeEach(() => jest.clearAllMocks());

describe("countries.saveIdentity", () => {
  it("writes only the identity fields that changed, the flag on the country, and the version", async () => {
    const { db, caller } = setup();
    const result = await caller.saveIdentity({
      ...base,
      identity: { capitalCity: "Port Test", motto: "" },
      flag: "https://example.com/flag.svg",
    });

    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY, updatedAt: base.expectedUpdatedAt },
      data: { flag: "https://example.com/flag.svg", updatedAt: result.updatedAt },
    });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith({
      where: { countryId: CALLER_COUNTRY },
      update: { capitalCity: "Port Test", motto: null },
      create: { countryId: CALLER_COUNTRY, capitalCity: "Port Test", motto: null },
    });
    expect(written(db)).toEqual(["country", "nationalIdentity"]);
  });

  it("saves the national animal", async () => {
    const { db, caller } = setup();
    await caller.saveIdentity({ ...base, identity: { nationalAnimal: "Lion" } });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { nationalAnimal: "Lion" } })
    );
  });

  it("keeps the country's religion copy in step", async () => {
    const { db, caller } = setup();
    await caller.saveIdentity({ ...base, identity: { nationalReligion: "Secular" } });
    expect(db.country.updateMany.mock.calls[0]![0].data).toMatchObject({ religion: "Secular" });
  });

  it("refuses values the editor's checks refuse", async () => {
    const { db, caller } = setup();
    await expect(
      caller.saveIdentity({ ...base, identity: { isoCode: "TOOLONG" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.saveIdentity({ ...base, identity: {}, flag: "javascript:alert(1)" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(written(db)).toEqual([]);
  });

  it("refuses a stale tab before writing anything", async () => {
    const { db, caller } = setup({ stale: true });
    await expect(
      caller.saveIdentity({ ...base, identity: { capitalCity: "Port Test" } })
    ).rejects.toMatchObject({ code: "CONFLICT", message: STALE_EDITOR_MESSAGE });
    expect(db.nationalIdentity.upsert).not.toHaveBeenCalled();
  });

  it("refuses another player's nation", async () => {
    const { db, caller } = setup();
    await expect(
      caller.saveIdentity({ ...base, countryId: FOREIGN_COUNTRY, identity: { motto: "Mine" } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(written(db)).toEqual([]);
  });
});

describe("countries.saveGovernmentForm", () => {
  const input = {
    ...base,
    governmentType: "Constitutional Monarchy",
    headOfState: "King",
    headOfGovernment: "Prime Minister",
    legislatureName: "Parliament",
    executiveName: "",
    judicialName: "High Court",
  };

  it("patches the structure's type and names and nothing of its departments or components", async () => {
    const { db, caller } = setup();
    await caller.saveGovernmentForm(input);
    expect(db.governmentStructure.update).toHaveBeenCalledWith({
      where: { countryId: CALLER_COUNTRY },
      data: {
        governmentType: "Constitutional Monarchy",
        headOfState: "King",
        headOfGovernment: "Prime Minister",
        legislatureName: "Parliament",
        executiveName: null,
        judicialName: "High Court",
      },
    });
    expect(db.country.updateMany.mock.calls[0]![0].data).toMatchObject({
      governmentType: "Constitutional Monarchy",
    });
    expect(db.nationalIdentity.updateMany).toHaveBeenCalledWith({
      where: { countryId: CALLER_COUNTRY },
      data: { governmentType: "Constitutional Monarchy" },
    });
    expect(written(db)).toEqual(["country", "governmentStructure", "nationalIdentity"]);
    expect(db.governmentDepartment.deleteMany).not.toHaveBeenCalled();
  });

  it("creates the structure when the nation has none", async () => {
    const { db, caller } = setup({ structure: false });
    await caller.saveGovernmentForm(input);
    expect(db.governmentStructure.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryId: CALLER_COUNTRY,
        governmentName: "Government of Testland",
        governmentType: "Constitutional Monarchy",
        headOfState: "King",
      }),
    });
    expect(db.governmentStructure.update).not.toHaveBeenCalled();
  });

  it("refuses a stale tab", async () => {
    const { db, caller } = setup({ stale: true });
    await expect(caller.saveGovernmentForm(input)).rejects.toMatchObject({ code: "CONFLICT" });
    // Only the version claim ran, and it matched no row.
    expect(written(db)).toEqual(["country"]);
  });
});

describe("countries.saveGovernmentComponents", () => {
  it("keeps the rows of kept components, adds new ones and removes the rest", async () => {
    const { db, caller } = setup();
    const result = await caller.saveGovernmentComponents({
      ...base,
      componentTypes: ["DEMOCRATIC_PROCESS", "INDEPENDENT_JUDICIARY"],
    });

    expect(db.governmentComponent.create).toHaveBeenCalledTimes(1);
    expect(db.governmentComponent.create.mock.calls[0]![0].data).toMatchObject({
      countryId: CALLER_COUNTRY,
      componentType: "INDEPENDENT_JUDICIARY",
      effectivenessScore: 50,
    });
    expect(db.governmentComponent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["gc_2"] } },
    });
    expect(db.governmentStructure.update).toHaveBeenCalledWith({
      where: { countryId: CALLER_COUNTRY },
      data: { governmentEffectiveness: expect.any(Number) },
    });
    expect(result).toMatchObject({ updatedAt: expect.any(Date), governmentEffectiveness: 55 });
    expect(written(db)).toEqual([
      "componentSynergy",
      "country",
      "governmentComponent",
      "governmentStructure",
    ]);
  });

  it("refuses more than 15 described institutions", async () => {
    const { db, caller } = setup();
    const many = [
      "DEMOCRATIC_PROCESS",
      "ELECTORAL_LEGITIMACY",
      "INDEPENDENT_JUDICIARY",
      "RULE_OF_LAW",
      "PROFESSIONAL_BUREAUCRACY",
      "UNITARY_SYSTEM",
      "FEDERAL_SYSTEM",
      "CENTRALIZED_POWER",
      "TRADITIONAL_LEGITIMACY",
      "TECHNOCRATIC_PROCESS",
      "MERIT_BASED_SYSTEM",
      "PERFORMANCE_LEGITIMACY",
      "TECHNOCRATIC_AGENCIES",
      "ECONOMIC_INCENTIVES",
      "TRADE_AGREEMENTS",
      "CULTURAL_PRESERVATION",
    ] as const;
    await expect(
      caller.saveGovernmentComponents({ ...base, componentTypes: [...many] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(written(db)).toEqual([]);
  });

  it("refuses a stale tab", async () => {
    const { db, caller } = setup({ stale: true });
    await expect(
      caller.saveGovernmentComponents({ ...base, componentTypes: ["RULE_OF_LAW"] })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Only the version claim ran, and it matched no row.
    expect(written(db)).toEqual(["country"]);
  });
});

describe("countries.saveSize", () => {
  it("rebases population and wealth and recalculates what follows from them, on the country only", async () => {
    const { db, caller } = setup();
    await caller.saveSize({ ...base, population: 20_000_000, gdpPerCapita: 30_000 });
    const data = db.country.updateMany.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      baselinePopulation: 20_000_000,
      baselineGdpPerCapita: 30_000,
      currentPopulation: 20_000_000,
      currentGdpPerCapita: 30_000,
      currentTotalGdp: 600_000_000_000,
      nominalGDP: 600_000_000_000,
      // The workforce keeps its 60% share.
      totalWorkforce: 12_000_000,
      populationDensity: 200,
    });
    expect(data.baselineDate).toBeInstanceOf(Date);
    expect(typeof data.economicTier).toBe("string");
    expect(written(db)).toEqual(["country"]);
  });

  it("refuses figures out of range and a stale tab", async () => {
    const { caller } = setup();
    await expect(
      caller.saveSize({ ...base, population: 10, gdpPerCapita: 30_000 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const stale = setup({ stale: true });
    await expect(
      stale.caller.saveSize({ ...base, population: 20_000_000, gdpPerCapita: 30_000 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("countries.rename", () => {
  it("renames, moves the slug, writes the identity name and leaves a redirect", async () => {
    const { db, caller } = setup();
    const result = await caller.rename({ ...base, name: "  New   Testland " });

    expect(result).toMatchObject({ name: "New Testland", slug: "new-testland" });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: { updatedAt: result.updatedAt, name: "New Testland", slug: "new-testland" },
    });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith({
      where: { countryId: CALLER_COUNTRY },
      update: { countryName: "New Testland" },
      create: { countryId: CALLER_COUNTRY, countryName: "New Testland" },
    });
    expect(db.countrySlugRedirect.deleteMany).toHaveBeenCalledWith({
      where: { oldSlug: "new-testland" },
    });
    expect(db.countrySlugRedirect.upsert).toHaveBeenCalledWith({
      where: { oldSlug: "testland" },
      update: { countryId: CALLER_COUNTRY },
      create: { oldSlug: "testland", countryId: CALLER_COUNTRY },
    });
    expect(written(db)).toEqual(["country", "countrySlugRedirect", "nationalIdentity"]);
    expect(invalidateRealmMap).toHaveBeenCalledWith(expect.anything(), "realm_1");
  });

  it("takes the next free slug when another nation holds the name's slug", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockImplementation(async ({ where }: { where: { slug?: string } }) =>
      where.slug === "new-testland" ? { id: "someone_else" } : null
    );
    const result = await caller.rename({ ...base, name: "New Testland" });
    expect(result.slug).toBe("new-testland-2");
  });

  it("refuses a name another nation of the realm has", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockResolvedValue({ id: "someone_else" });
    await expect(caller.rename({ ...base, name: "Taken" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nation in this realm has this name.",
    });
    expect(written(db)).toEqual([]);
  });

  it("refuses a stale tab", async () => {
    const { db, caller } = setup({ stale: true });
    await expect(caller.rename({ ...base, name: "New Testland" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: STALE_EDITOR_MESSAGE,
    });
    expect(db.countrySlugRedirect.upsert).not.toHaveBeenCalled();
  });
});

describe("countries.checkNameAvailable", () => {
  it("accepts a free name and the nation's own", async () => {
    const { caller } = setup();
    await expect(
      caller.checkNameAvailable({ countryId: CALLER_COUNTRY, name: "Freeland" })
    ).resolves.toEqual({ available: true, reason: null });
    await expect(
      caller.checkNameAvailable({ countryId: CALLER_COUNTRY, name: "Testland" })
    ).resolves.toEqual({ available: true, reason: null });
  });

  it("refuses a taken name, a lore nation and a name without letters", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockResolvedValueOnce({ id: "someone_else" });
    await expect(
      caller.checkNameAvailable({ countryId: CALLER_COUNTRY, name: "taken" })
    ).resolves.toMatchObject({ available: false });
    expect(db.country.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmId: "realm_1",
          id: { not: CALLER_COUNTRY },
          name: { equals: "taken", mode: "insensitive" },
        },
      })
    );

    db.realmPage.findFirst.mockResolvedValueOnce({ title: "Lorelia" });
    await expect(
      caller.checkNameAvailable({ countryId: CALLER_COUNTRY, name: "Lorelia" })
    ).resolves.toEqual({
      available: false,
      reason: '"Lorelia" is a nation of this realm\'s lore. Claim it on the realm page instead.',
    });

    await expect(
      caller.checkNameAvailable({ countryId: CALLER_COUNTRY, name: "!!!" })
    ).resolves.toMatchObject({ available: false });
  });

  it("refuses to check for another player's nation", async () => {
    const { caller } = setup();
    await expect(
      caller.checkNameAvailable({ countryId: FOREIGN_COUNTRY, name: "Freeland" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
