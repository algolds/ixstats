/** @jest-environment node */
/**
 * The country editor's section saves: each patches only its own rows and columns, refuses another player's nation
 * (FORBIDDEN) and refuses (CONFLICT, before writing anything) only when a field it changes no longer holds the value
 * the page loaded. Writes to anything else, such as the stat progression moving the current figures or a console
 * touching the country row, never refuse a save: one row per section. Then what each save writes: the identity's
 * changed fields only, the form without touching departments, components synced in place (their scores kept), the
 * size rebased, and a rename that moves the slug and leaves a redirect behind, also from Settings.
 *
 * Folds the Settings rename of country-rename (its redirect lookups are in slug-redirect-layout).
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
jest.mock("~/server/shared/intelligence-alert-thresholds", () => ({
  evaluateCountryThresholds: jest.fn().mockResolvedValue(undefined),
}));

import { createTRPCRouter } from "~/server/api/trpc";
import { editorProcedures } from "~/server/api/routers/countries/editor";
import { managementLifecycleProcedures } from "~/server/api/routers/countries/management/lifecycle";
import { staleMessage } from "~/lib/mycountry/editor-fields";
import { createRealmClock, withSpeed } from "~/lib/realms/realm-clock";
import { resetRealmClockCache } from "~/server/shared/realm-time";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

type Mock = jest.Mock;

const REALM_NOW = Date.UTC(2046, 2, 14, 9);
const REAL_NOW = Date.now();
const REALM_CLOCK = withSpeed(
  createRealmClock({
    globalNowMs: REALM_NOW,
    realNowMs: REAL_NOW,
    startDate: "1203-03-14",
    era: "AE",
    multiplier: 2,
  }),
  0,
  REAL_NOW
);
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

/** What the database holds; a test edits it to play another tab or a background write. */
function storedRows() {
  return {
    country: {
      id: CALLER_COUNTRY,
      name: "Testland",
      slug: "testland",
      realmId: "realm_1",
      ownerUserId: "db_user_caller",
      flag: "https://example.com/old.svg",
      coatOfArms: null as string | null,
      governmentType: "Parliamentary Republic",
      baselinePopulation: 9_000_000,
      baselineGdpPerCapita: 25_000,
      currentPopulation: 10_000_000,
      currentTotalGdp: 250_000_000_000,
      totalWorkforce: 6_000_000,
      landArea: 100_000,
      inflationRate: null as number | null,
      unemploymentRate: 6.1 as number | null,
      totalDebtGDPRatio: null as number | null,
      updatedAt: new Date("2026-10-20T10:00:00.000Z"),
    },
    identity: {
      capitalCity: "Old Port",
      motto: "Onward",
      demonym: "Testish",
      nationalAnimal: null as string | null,
      nationalReligion: null as string | null,
      isoCode: null as string | null,
    } as Record<string, string | null>,
    structure: {
      id: "gs_1",
      governmentType: "Parliamentary Republic",
      headOfState: "President",
      headOfGovernment: "Prime Minister",
      legislatureName: "Parliament",
      executiveName: "Cabinet",
      judicialName: "Supreme Court",
      governmentEffectiveness: 55,
    } as Record<string, unknown> | null,
    components: [
      { id: "gc_1", componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 70 },
      { id: "gc_2", componentType: "RULE_OF_LAW", effectivenessScore: 64 },
    ],
  };
}

/** Every table the editor could touch, so a test can assert which ones a save left alone. */
function setup(edit: (rows: ReturnType<typeof storedRows>) => void = () => {}) {
  resetRealmClockCache();
  const rows = storedRows();
  edit(rows);
  const db: Record<string, Model | Mock> = {
    country: model({
      findUnique: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id === CALLER_COUNTRY) return rows.country;
        if (where.id === FOREIGN_COUNTRY) return { id: FOREIGN_COUNTRY, ownerUserId: "someone" };
        return null;
      }),
    }),
    nationalIdentity: model({ findUnique: jest.fn(async () => rows.identity) }),
    governmentStructure: model({ findUnique: jest.fn(async () => rows.structure) }),
    governmentComponent: model({ findMany: jest.fn(async () => rows.components) }),
    componentSynergy: model(),
    governmentDepartment: model(),
    budgetAllocation: model(),
    taxSystem: model(),
    fiscalSystem: model(),
    economicComponent: model(),
    realmPage: model(),
    countrySlugRedirect: model(),
    // Testland's realm, its clock paused at REALM_NOW
    realm: model({ findUnique: jest.fn(async () => ({ settings: { clock: REALM_CLOCK } })) }),
    systemConfig: model(),
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

/** A background write to country columns no section edits (stat progression, consoles). */
const backgroundWrite = (rows: ReturnType<typeof storedRows>) => {
  rows.country.currentPopulation = 10_400_000;
  rows.country.updatedAt = new Date("2026-10-20T16:23:00.000Z");
};

const countryId = CALLER_COUNTRY;
const LOADED_FORM = {
  governmentType: "Parliamentary Republic",
  headOfState: "President",
  headOfGovernment: "Prime Minister",
  legislatureName: "Parliament",
  executiveName: "Cabinet",
  judicialName: "Supreme Court",
};

beforeEach(() => jest.clearAllMocks());

const saveCapital = {
  countryId,
  section: "language" as const,
  identity: { capitalCity: "Port Test", motto: "" },
  expected: { identity: { capitalCity: "Old Port", motto: "Onward" } },
};
const formInput = {
  countryId,
  governmentType: "Constitutional Monarchy",
  headOfState: "King",
  headOfGovernment: "Prime Minister",
  legislatureName: "Parliament",
  executiveName: "",
  judicialName: "High Court",
  expected: LOADED_FORM,
};
const componentsInput = {
  countryId,
  componentTypes: ["DEMOCRATIC_PROCESS" as const, "INDEPENDENT_JUDICIARY" as const],
  expected: { componentTypes: ["RULE_OF_LAW", "DEMOCRATIC_PROCESS"] },
};
const sizeInput = {
  countryId,
  population: 20_000_000,
  gdpPerCapita: 30_000,
  expected: { baselinePopulation: 9_000_000, baselineGdpPerCapita: 25_000 },
};
const figuresInput = {
  countryId,
  figures: { inflationRate: 3.2, unemploymentRate: null },
  expected: { inflationRate: null, unemploymentRate: 6.1 },
};
const renameInput = { countryId, name: "  New   Testland ", expected: { name: "Testland" } };

type Caller = ReturnType<typeof setup>["caller"];
type Rows = ReturnType<typeof storedRows>;
const SECTIONS: Array<{
  name: string;
  save: (caller: Caller, target: string) => Promise<unknown>;
  /** Another tab saving the same section after this page loaded. */
  anotherTab: (rows: Rows) => void;
  stale: string;
}> = [
  {
    name: "saveIdentity",
    save: (c, target) => c.saveIdentity({ ...saveCapital, countryId: target }),
    anotherTab: (rows) => {
      rows.identity.motto = "Forward";
    },
    stale: "Capital and language changed since you opened it",
  },
  {
    name: "saveGovernmentForm",
    save: (c, target) => c.saveGovernmentForm({ ...formInput, countryId: target }),
    anotherTab: (rows) => {
      rows.structure!.judicialName = "Court of Appeal";
    },
    stale: "Form and institutions changed since you opened it",
  },
  {
    name: "saveGovernmentComponents",
    save: (c, target) =>
      c.saveGovernmentComponents({
        ...componentsInput,
        componentTypes: [...componentsInput.componentTypes],
        countryId: target,
      }),
    anotherTab: (rows) => {
      rows.components = rows.components.slice(0, 1);
    },
    stale: staleMessage("institutions"),
  },
  {
    name: "saveSize",
    save: (c, target) => c.saveSize({ ...sizeInput, countryId: target }),
    anotherTab: (rows) => {
      rows.country.baselinePopulation = 15_000_000;
    },
    stale: "Population and wealth changed since you opened it",
  },
  {
    name: "saveEconomicFigures",
    save: (c, target) => c.saveEconomicFigures({ ...figuresInput, countryId: target }),
    anotherTab: (rows) => {
      rows.country.unemploymentRate = 7;
    },
    stale: staleMessage("figures"),
  },
  {
    name: "rename",
    save: (c, target) => c.rename({ ...renameInput, countryId: target }),
    anotherTab: (rows) => {
      rows.country.name = "Otherland";
    },
    stale: staleMessage("name"),
  },
];

describe("every section save", () => {
  it.each(SECTIONS)(
    "$name refuses another player's nation and a page another tab outdated, and no background write refuses it",
    async ({ save, anotherTab, stale }) => {
      const attempt = async (edit: (rows: Rows) => void, target = countryId) => {
        const { db, caller } = setup(edit);
        const result = await save(caller, target).then(
          () => "saved",
          (error: { code?: string; message?: string }) =>
            error.code === "CONFLICT" ? `CONFLICT: ${error.message}` : error.code
        );
        return { result, wrote: written(db) };
      };
      expect({
        foreign: await attempt(() => {}, FOREIGN_COUNTRY),
        anotherTab: await attempt(anotherTab),
        backgroundWrite: (await attempt(backgroundWrite)).result,
      }).toEqual({
        foreign: { result: "FORBIDDEN", wrote: [] },
        anotherTab: { result: `CONFLICT: ${stale}`, wrote: [] },
        backgroundWrite: "saved",
      });
    }
  );

  it("refuses values the checks refuse, fields of another section and missing originals", async () => {
    const { db, caller } = setup();
    const refuses = (input: Parameters<Caller["saveIdentity"]>[0]) =>
      expect(caller.saveIdentity(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await refuses({
      countryId,
      section: "civic",
      identity: { isoCode: "TOOLONG" },
      expected: { identity: { isoCode: null } },
    });
    await refuses({
      countryId,
      section: "civic",
      identity: { motto: "Mine" },
      expected: { identity: { motto: "Onward" } },
    });
    await refuses({
      countryId,
      section: "language",
      identity: { motto: "Mine" },
      expected: { identity: {} },
    });
    await refuses({
      countryId,
      section: "symbols",
      identity: {},
      flag: "javascript:alert(1)",
      expected: { identity: {}, flag: null },
    });
    await expect(caller.saveSize({ ...sizeInput, population: 10 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(written(db)).toEqual([]);
  });
});

describe("what each save writes", () => {
  it("saveEconomicFigures stores a typed figure, clears an emptied one to null and returns them", async () => {
    const { db, caller } = setup();
    const result = await caller.saveEconomicFigures(figuresInput);
    expect(result).toEqual({ inflationRate: 3.2, unemploymentRate: null });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { inflationRate: 3.2, unemploymentRate: null },
    });
    expect(written(db)).toEqual(["country"]);
  });

  it("saveEconomicFigures keeps a 0% debt but refuses 0% inflation or unemployment, bad bounds and missing originals", async () => {
    const { db, caller } = setup();
    const refuses = (input: Parameters<Caller["saveEconomicFigures"]>[0]) =>
      expect(caller.saveEconomicFigures(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await refuses({ countryId, figures: { inflationRate: 0 }, expected: { inflationRate: null } });
    await refuses({
      countryId,
      figures: { unemploymentRate: 0 },
      expected: { unemploymentRate: 6.1 },
    });
    await refuses({
      countryId,
      figures: { unemploymentRate: 80 },
      expected: { unemploymentRate: 6.1 },
    });
    await refuses({ countryId, figures: { totalDebtGDPRatio: 40 }, expected: {} });
    expect(written(db)).toEqual([]);
    expect(
      await caller.saveEconomicFigures({
        countryId,
        figures: { totalDebtGDPRatio: 0 },
        expected: { totalDebtGDPRatio: null },
      })
    ).toEqual({ totalDebtGDPRatio: 0 });
  });

  it("saveIdentity writes only the fields that changed and returns them", async () => {
    const { db, caller } = setup();
    expect(await caller.saveIdentity(saveCapital)).toEqual({
      identity: { capitalCity: "Port Test", motto: null },
    });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith({
      where: { countryId },
      update: { capitalCity: "Port Test", motto: null },
      create: { countryId, capitalCity: "Port Test", motto: null },
    });
    expect(written(db)).toEqual(["nationalIdentity"]);
  });

  it("saveIdentity refuses a new capital name while the capital is placed on the map, and saves the rest", async () => {
    const { db, caller } = setup((rows) => {
      rows.identity.capitalCityId = "city_1";
    });
    await expect(caller.saveIdentity(saveCapital)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Your capital is placed on the map. Rename or move it in the map editor.",
    });
    expect(written(db)).toEqual([]);

    await caller.saveIdentity({
      ...saveCapital,
      identity: { motto: "" },
      expected: { identity: { motto: "Onward" } },
    });
    expect(written(db)).toEqual(["nationalIdentity"]);
  });

  it("saveGovernmentForm patches the type and names and nothing of departments or components", async () => {
    const { db, caller } = setup();
    const saved = {
      governmentType: "Constitutional Monarchy",
      headOfState: "King",
      headOfGovernment: "Prime Minister",
      legislatureName: "Parliament",
      executiveName: null,
      judicialName: "High Court",
    };
    expect(await caller.saveGovernmentForm(formInput)).toEqual(saved);
    expect(db.governmentStructure.update).toHaveBeenCalledWith({
      where: { countryId },
      data: saved,
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { governmentType: "Constitutional Monarchy" },
    });
    expect(written(db)).toEqual(["country", "governmentStructure", "nationalIdentity"]);
  });

  it("saveGovernmentComponents keeps the rows of kept components, adds new ones and removes the rest", async () => {
    const { db, caller } = setup();
    const result = await caller.saveGovernmentComponents({
      ...componentsInput,
      componentTypes: [...componentsInput.componentTypes],
    });
    expect(db.governmentComponent.create).toHaveBeenCalledTimes(1);
    expect(db.governmentComponent.create.mock.calls[0]![0].data).toMatchObject({
      countryId,
      componentType: "INDEPENDENT_JUDICIARY",
      effectivenessScore: 50,
    });
    expect(db.governmentComponent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["gc_2"] } },
    });
    expect(result).toMatchObject({ components: expect.any(Array), governmentEffectiveness: 55 });
    expect(written(db)).toEqual(["componentSynergy", "governmentComponent", "governmentStructure"]);
  });

  it("saveSize rebases population and wealth, recalculates what follows and moves the budget with the GDP", async () => {
    const { db, caller } = setup();
    (db.budgetAllocation.findFirst as Mock).mockResolvedValue({ budgetYear: 2042 });
    const result = await caller.saveSize(sizeInput);
    const data = db.country.update.mock.calls[0]![0].data;
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
    // The new baseline is dated with Testland's realm clock, and its budget year is that clock's
    expect(data.baselineDate).toEqual(new Date(REALM_NOW));
    expect(db.budgetAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { governmentStructure: { countryId }, budgetYear: { lte: 2046 } },
      })
    );
    expect(result).toEqual({
      baselinePopulation: 20_000_000,
      baselineGdpPerCapita: 30_000,
      currentPopulation: 20_000_000,
      currentGdpPerCapita: 30_000,
    });
    // GDP goes from 250B to 600B: the yearly budget and its allocations move by 2.4.
    expect(db.governmentStructure.updateMany).toHaveBeenCalledWith({
      where: { countryId },
      data: { totalBudget: { multiply: 2.4 } },
    });
    expect(db.budgetAllocation.updateMany).toHaveBeenCalledWith({
      where: { governmentStructure: { countryId }, budgetYear: 2042 },
      data: { allocatedAmount: { multiply: 2.4 }, availableAmount: { multiply: 2.4 } },
    });
    expect(written(db)).toEqual(["budgetAllocation", "country", "governmentStructure"]);
  });

  it("rename moves the slug, writes the identity name and leaves a redirect", async () => {
    const { db, caller } = setup();
    expect(await caller.rename(renameInput)).toEqual({
      name: "New Testland",
      slug: "new-testland",
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { name: "New Testland", slug: "new-testland" },
    });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith({
      where: { countryId },
      update: { countryName: "New Testland" },
      create: { countryId, countryName: "New Testland" },
    });
    expect(db.countrySlugRedirect.deleteMany).toHaveBeenCalledWith({
      where: { oldSlug: "new-testland" },
    });
    expect(db.countrySlugRedirect.upsert).toHaveBeenCalledWith({
      where: { oldSlug: "testland" },
      update: { countryId },
      create: { oldSlug: "testland", countryId },
    });
    expect(invalidateRealmMap).toHaveBeenCalledWith(expect.anything(), "realm_1");
  });

  it("rename takes the next free slug, and refuses a name another nation of the realm has", async () => {
    const slugTaken = setup();
    slugTaken.db.country.findFirst.mockImplementation(
      async ({ where }: { where: { slug?: string } }) =>
        where.slug === "new-testland" ? { id: "someone_else" } : null
    );
    expect((await slugTaken.caller.rename(renameInput)).slug).toBe("new-testland-2");

    const nameTaken = setup();
    nameTaken.db.country.findFirst.mockResolvedValue({ id: "someone_else" });
    await expect(nameTaken.caller.rename({ ...renameInput, name: "Taken" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nation in this realm has this name.",
    });
    expect(written(nameTaken.db)).toEqual([]);
  });

  it("a Settings rename (countries.update with a name) goes through the same rename", async () => {
    const { db } = setup();
    db.country.findUnique.mockResolvedValue({
      id: CALLER_COUNTRY,
      name: "Testland",
      slug: "testland",
      realmId: "realm_1",
      continent: null,
      region: null,
    });
    const settings = createTRPCRouter(managementLifecycleProcedures).createCaller(
      createIdorContext(db as never)
    );
    await settings.update({ id: CALLER_COUNTRY, name: "New Testland" });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: expect.objectContaining({ name: "New Testland", slug: "new-testland" }),
    });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { countryName: "New Testland" } })
    );
    expect(db.countrySlugRedirect.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { oldSlug: "testland", countryId: CALLER_COUNTRY } })
    );
  });

  it("checkNameAvailable refuses a taken name, a lore nation and a name without letters, for the caller's nation only", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockResolvedValueOnce({ id: "someone_else" });
    await expect(caller.checkNameAvailable({ countryId, name: "taken" })).resolves.toMatchObject({
      available: false,
    });
    expect(db.country.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmId: "realm_1",
          id: { not: countryId },
          name: { equals: "taken", mode: "insensitive" },
        },
      })
    );
    db.realmPage.findFirst.mockResolvedValueOnce({ title: "Lorelia" });
    await expect(caller.checkNameAvailable({ countryId, name: "Lorelia" })).resolves.toEqual({
      available: false,
      reason: '"Lorelia" is a nation of this realm\'s lore. Claim it on the realm page instead.',
    });
    await expect(caller.checkNameAvailable({ countryId, name: "!!!" })).resolves.toMatchObject({
      available: false,
    });
    await expect(
      caller.checkNameAvailable({ countryId: FOREIGN_COUNTRY, name: "Freeland" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
