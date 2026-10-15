/** @jest-environment node */
/**
 * The country editor's section saves: each patches only its own rows and columns, and refuses
 * (CONFLICT, before writing anything) only when a field it changes no longer holds the value the
 * page loaded. Writes to anything else, such as the stat progression moving the current figures
 * or a console touching the country row, never refuse a save. Renaming moves the slug and leaves
 * a redirect behind.
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
import { staleMessage } from "~/lib/mycountry/editor-fields";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

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
      totalWorkforce: 6_000_000,
      landArea: 100_000,
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

describe("countries.saveIdentity", () => {
  const saveCapital = {
    countryId,
    section: "language" as const,
    identity: { capitalCity: "Port Test", motto: "" },
    expected: { identity: { capitalCity: "Old Port", motto: "Onward" } },
  };

  it("writes only the fields that changed and returns them", async () => {
    const { db, caller } = setup();
    const result = await caller.saveIdentity(saveCapital);

    expect(result).toEqual({ identity: { capitalCity: "Port Test", motto: null } });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith({
      where: { countryId },
      update: { capitalCity: "Port Test", motto: null },
      create: { countryId, capitalCity: "Port Test", motto: null },
    });
    expect(written(db)).toEqual(["nationalIdentity"]);
  });

  it("writes the flag on the country and saves the national animal", async () => {
    const { db, caller } = setup();
    const result = await caller.saveIdentity({
      countryId,
      section: "symbols",
      identity: { nationalAnimal: "Lion" },
      flag: "https://example.com/flag.svg",
      expected: { identity: { nationalAnimal: null }, flag: "https://example.com/old.svg" },
    });
    expect(result).toEqual({
      identity: { nationalAnimal: "Lion" },
      flag: "https://example.com/flag.svg",
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { flag: "https://example.com/flag.svg" },
    });
    expect(written(db)).toEqual(["country", "nationalIdentity"]);
  });

  it("keeps the country's religion copy in step", async () => {
    const { db, caller } = setup();
    await caller.saveIdentity({
      countryId,
      section: "culture",
      identity: { nationalReligion: "Secular" },
      expected: { identity: { nationalReligion: null } },
    });
    expect(db.country.update.mock.calls[0]![0].data).toEqual({ religion: "Secular" });
  });

  it("is not refused by a background write or by another tab saving other fields", async () => {
    const { db, caller } = setup((rows) => {
      backgroundWrite(rows);
      rows.identity.demonym = "Testian";
    });
    await expect(caller.saveIdentity(saveCapital)).resolves.toBeDefined();
    expect(db.nationalIdentity.upsert).toHaveBeenCalled();
  });

  it("is refused when a field it changes moved since the page loaded", async () => {
    const { db, caller } = setup((rows) => {
      rows.identity.motto = "Forward";
    });
    await expect(caller.saveIdentity(saveCapital)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Capital and language changed since you opened it",
    });
    expect(written(db)).toEqual([]);
  });

  it("is refused when the flag moved since the page loaded", async () => {
    const { db, caller } = setup((rows) => {
      rows.country.flag = "https://example.com/other.svg";
    });
    await expect(
      caller.saveIdentity({
        countryId,
        section: "symbols",
        identity: {},
        flag: "https://example.com/flag.svg",
        expected: { identity: {}, flag: "https://example.com/old.svg" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: staleMessage("symbols") });
    expect(written(db)).toEqual([]);
  });

  it("refuses values the checks refuse, fields of another section and missing originals", async () => {
    const { db, caller } = setup();
    await expect(
      caller.saveIdentity({
        countryId,
        section: "civic",
        identity: { isoCode: "TOOLONG" },
        expected: { identity: { isoCode: null } },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.saveIdentity({
        countryId,
        section: "civic",
        identity: { motto: "Mine" },
        expected: { identity: { motto: "Onward" } },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.saveIdentity({
        countryId,
        section: "language",
        identity: { motto: "Mine" },
        expected: { identity: {} },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.saveIdentity({
        countryId,
        section: "symbols",
        identity: {},
        flag: "javascript:alert(1)",
        expected: { identity: {}, flag: null },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(written(db)).toEqual([]);
  });

  it("refuses another player's nation", async () => {
    const { db, caller } = setup();
    await expect(
      caller.saveIdentity({ ...saveCapital, countryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(written(db)).toEqual([]);
  });
});

describe("countries.saveGovernmentForm", () => {
  const input = {
    countryId,
    governmentType: "Constitutional Monarchy",
    headOfState: "King",
    headOfGovernment: "Prime Minister",
    legislatureName: "Parliament",
    executiveName: "",
    judicialName: "High Court",
    expected: LOADED_FORM,
  };

  it("patches the type and names and nothing of departments or components", async () => {
    const { db, caller } = setup();
    const result = await caller.saveGovernmentForm(input);
    const saved = {
      governmentType: "Constitutional Monarchy",
      headOfState: "King",
      headOfGovernment: "Prime Minister",
      legislatureName: "Parliament",
      executiveName: null,
      judicialName: "High Court",
    };
    expect(result).toEqual(saved);
    expect(db.governmentStructure.update).toHaveBeenCalledWith({
      where: { countryId },
      data: saved,
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: countryId },
      data: { governmentType: "Constitutional Monarchy" },
    });
    expect(db.nationalIdentity.updateMany).toHaveBeenCalledWith({
      where: { countryId },
      data: { governmentType: "Constitutional Monarchy" },
    });
    expect(written(db)).toEqual(["country", "governmentStructure", "nationalIdentity"]);
  });

  it("creates the structure when the nation has none, checking the country's type", async () => {
    const { db, caller } = setup((rows) => {
      rows.structure = null;
    });
    await caller.saveGovernmentForm({
      ...input,
      expected: {
        governmentType: "Parliamentary Republic",
        headOfState: null,
        headOfGovernment: null,
        legislatureName: null,
        executiveName: null,
        judicialName: null,
      },
    });
    expect(db.governmentStructure.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryId,
        governmentName: "Government of Testland",
        governmentType: "Constitutional Monarchy",
        headOfState: "King",
      }),
    });
    expect(db.governmentStructure.update).not.toHaveBeenCalled();
  });

  it("is not refused by a background write", async () => {
    const { caller } = setup(backgroundWrite);
    await expect(caller.saveGovernmentForm(input)).resolves.toBeDefined();
  });

  it("is refused when another tab renamed an institution", async () => {
    const { db, caller } = setup((rows) => {
      rows.structure!.judicialName = "Court of Appeal";
    });
    await expect(caller.saveGovernmentForm(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Form and institutions changed since you opened it",
    });
    expect(written(db)).toEqual([]);
  });
});

describe("countries.saveGovernmentComponents", () => {
  const input = {
    countryId,
    componentTypes: ["DEMOCRATIC_PROCESS", "INDEPENDENT_JUDICIARY"] as const,
    expected: { componentTypes: ["RULE_OF_LAW", "DEMOCRATIC_PROCESS"] },
  };

  it("keeps the rows of kept components, adds new ones and removes the rest", async () => {
    const { db, caller } = setup();
    const result = await caller.saveGovernmentComponents({
      ...input,
      componentTypes: [...input.componentTypes],
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
    expect(db.governmentStructure.update).toHaveBeenCalledWith({
      where: { countryId },
      data: { governmentEffectiveness: expect.any(Number) },
    });
    expect(result).toMatchObject({ components: expect.any(Array), governmentEffectiveness: 55 });
    expect(written(db)).toEqual(["componentSynergy", "governmentComponent", "governmentStructure"]);
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
      caller.saveGovernmentComponents({ ...input, componentTypes: [...many] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(written(db)).toEqual([]);
  });

  it("is not refused by a background write", async () => {
    const { caller } = setup(backgroundWrite);
    await expect(
      caller.saveGovernmentComponents({ ...input, componentTypes: [...input.componentTypes] })
    ).resolves.toBeDefined();
  });

  it("is refused when another tab changed the component set", async () => {
    const { db, caller } = setup((rows) => {
      rows.components = [...rows.components.slice(0, 1)];
    });
    await expect(
      caller.saveGovernmentComponents({ ...input, componentTypes: [...input.componentTypes] })
    ).rejects.toMatchObject({ code: "CONFLICT", message: staleMessage("institutions") });
    expect(written(db)).toEqual([]);
  });
});

describe("countries.saveSize", () => {
  const input = {
    countryId,
    population: 20_000_000,
    gdpPerCapita: 30_000,
    expected: { baselinePopulation: 9_000_000, baselineGdpPerCapita: 25_000 },
  };

  it("rebases population and wealth and recalculates what follows, on the country only", async () => {
    const { db, caller } = setup();
    const result = await caller.saveSize(input);
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
    expect(data.baselineDate).toBeInstanceOf(Date);
    expect(typeof data.economicTier).toBe("string");
    expect(result).toEqual({
      baselinePopulation: 20_000_000,
      baselineGdpPerCapita: 30_000,
      currentPopulation: 20_000_000,
      currentGdpPerCapita: 30_000,
    });
    expect(written(db)).toEqual(["country"]);
  });

  it("is not refused when the stat progression moved the current figures", async () => {
    const { caller } = setup(backgroundWrite);
    await expect(caller.saveSize(input)).resolves.toBeDefined();
  });

  it("is refused when another tab saved a new size", async () => {
    const { db, caller } = setup((rows) => {
      rows.country.baselinePopulation = 15_000_000;
    });
    await expect(caller.saveSize(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Population and wealth changed since you opened it",
    });
    expect(written(db)).toEqual([]);
  });

  it("refuses figures out of range", async () => {
    const { caller } = setup();
    await expect(caller.saveSize({ ...input, population: 10 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("countries.rename", () => {
  const input = { countryId, name: "  New   Testland ", expected: { name: "Testland" } };

  it("renames, moves the slug, writes the identity name and leaves a redirect", async () => {
    const { db, caller } = setup();
    const result = await caller.rename(input);

    expect(result).toEqual({ name: "New Testland", slug: "new-testland" });
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
    expect(written(db)).toEqual(["country", "countrySlugRedirect", "nationalIdentity"]);
    expect(invalidateRealmMap).toHaveBeenCalledWith(expect.anything(), "realm_1");
  });

  it("takes the next free slug when another nation holds the name's slug", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockImplementation(async ({ where }: { where: { slug?: string } }) =>
      where.slug === "new-testland" ? { id: "someone_else" } : null
    );
    const result = await caller.rename(input);
    expect(result.slug).toBe("new-testland-2");
  });

  it("refuses a name another nation of the realm has", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockResolvedValue({ id: "someone_else" });
    await expect(caller.rename({ ...input, name: "Taken" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nation in this realm has this name.",
    });
    expect(written(db)).toEqual([]);
  });

  it("is not refused by a background write", async () => {
    const { caller } = setup(backgroundWrite);
    await expect(caller.rename(input)).resolves.toBeDefined();
  });

  it("is refused when another tab renamed the nation", async () => {
    const { db, caller } = setup((rows) => {
      rows.country.name = "Otherland";
    });
    await expect(caller.rename(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: staleMessage("name"),
    });
    expect(db.countrySlugRedirect.upsert).not.toHaveBeenCalled();
    expect(written(db)).toEqual([]);
  });
});

describe("countries.checkNameAvailable", () => {
  it("accepts a free name and the nation's own", async () => {
    const { caller } = setup();
    await expect(caller.checkNameAvailable({ countryId, name: "Freeland" })).resolves.toEqual({
      available: true,
      reason: null,
    });
    await expect(caller.checkNameAvailable({ countryId, name: "Testland" })).resolves.toEqual({
      available: true,
      reason: null,
    });
  });

  it("refuses a taken name, a lore nation and a name without letters", async () => {
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
  });

  it("refuses to check for another player's nation", async () => {
    const { caller } = setup();
    await expect(
      caller.checkNameAvailable({ countryId: FOREIGN_COUNTRY, name: "Freeland" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
