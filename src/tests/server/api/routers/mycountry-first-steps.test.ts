/**
 * MyCountry after founding: the welcome summary and the "First steps" checklist, whose items tick
 * from the rows each console writes (never the rows founding itself wrote), and the per-nation
 * dismissal.
 */
import { readFileSync } from "node:fs";
import { myCountryFirstStepsRouter } from "~/server/api/routers/mycountry/first-steps";
import {
  FIRST_STEPS_WINDOW_MS,
  FOUNDING_GRACE_MS,
  foundedAt,
  hasMapCoordinates,
  shouldShowFirstSteps,
  type FirstSteps,
} from "~/lib/mycountry/first-steps";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const NOW = Date.now();
const FOUNDED = new Date(NOW - 2 * 24 * 60 * 60 * 1000);
/** A write founding made, a moment after the nation was created. */
const DURING_FOUNDING = new Date(FOUNDED.getTime() + 2_000);
/** A write the player made later, from a console. */
const LATER = new Date(FOUNDED.getTime() + FOUNDING_GRACE_MS + 60_000);

interface Rows {
  country?: Record<string, unknown>;
  budgetAllocations?: Array<{ updatedAt: Date }>;
  fiscal?: { updatedAt: Date } | null;
  tax?: { updatedAt: Date } | null;
  officials?: number;
  wikiArticle?: { id: string } | null;
  capital?: { coordinates: unknown } | null;
}

function countryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CALLER_COUNTRY,
    name: "Testland",
    createdAt: FOUNDED,
    ownedSince: FOUNDED,
    updatedAt: FOUNDED,
    wikiPageTitle: null,
    wikiSource: "ixwiki",
    firstStepsDismissedAt: null,
    ...overrides,
  };
}

function setup(rows: Rows = {}) {
  const own = countryRow(rows.country);
  const db = {
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === CALLER_COUNTRY ? own : { id: where.id, ownerUserId: "db_user_someone_else" }
      ),
      update: jest.fn(async () => own),
    },
    budgetAllocation: {
      // Mirrors the `updatedAt > threshold` filter the query sends.
      findFirst: jest.fn(async ({ where }: { where: { updatedAt: { gt: Date } } }) => {
        const hit = (rows.budgetAllocations ?? []).find(
          (row) => row.updatedAt.getTime() > where.updatedAt.gt.getTime()
        );
        return hit ? { id: "alloc_1" } : null;
      }),
    },
    fiscalSystem: { findUnique: jest.fn(async () => rows.fiscal ?? null) },
    taxSystem: { findUnique: jest.fn(async () => rows.tax ?? null) },
    governmentOfficial: { count: jest.fn(async () => rows.officials ?? 0) },
    wikiArticle: { findFirst: jest.fn(async () => rows.wikiArticle ?? null) },
    city: { findFirst: jest.fn(async () => rows.capital ?? null) },
  };
  return { db, caller: myCountryFirstStepsRouter.createCaller(createIdorContext(db)) };
}

const doneById = (steps: FirstSteps | null) =>
  Object.fromEntries((steps?.items ?? []).map((item) => [item.id, item.done]));

describe("mycountry.getFirstSteps", () => {
  it("leaves every step open for a nation that only has its founding rows", async () => {
    const { caller } = setup({
      budgetAllocations: [{ updatedAt: DURING_FOUNDING }],
      fiscal: { updatedAt: DURING_FOUNDING },
      tax: { updatedAt: DURING_FOUNDING },
    });
    const steps = await caller.getFirstSteps();
    expect(steps).toMatchObject({ countryId: CALLER_COUNTRY, dismissed: false, recent: true });
    expect(doneById(steps)).toEqual({
      budget: false,
      tax: false,
      cabinet: false,
      wiki: false,
      capital: false,
    });
  });

  it("ticks each step from the rows its console writes", async () => {
    const { caller, db } = setup({
      budgetAllocations: [{ updatedAt: DURING_FOUNDING }, { updatedAt: LATER }],
      fiscal: { updatedAt: LATER },
      tax: { updatedAt: DURING_FOUNDING },
      officials: 2,
      wikiArticle: { id: "article_1" },
      capital: { coordinates: [12.5, 41.9] },
    });
    const steps = await caller.getFirstSteps();
    expect(doneById(steps)).toEqual({
      budget: true,
      tax: true,
      cabinet: true,
      wiki: true,
      capital: true,
    });
    expect(db.budgetAllocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ governmentStructure: { countryId: CALLER_COUNTRY } }),
      })
    );
    expect(db.wikiArticle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: "ixwiki", title: "Testland" }),
      })
    );
    expect(shouldShowFirstSteps(steps)).toBe(false);
  });

  it("counts a tax system written after founding, and a page named on the nation", async () => {
    const { caller, db } = setup({
      country: { wikiPageTitle: "Republic of Testland" },
      tax: { updatedAt: LATER },
    });
    const steps = await caller.getFirstSteps();
    expect(doneById(steps)).toMatchObject({ tax: true, wiki: true });
    expect(db.wikiArticle.findFirst).not.toHaveBeenCalled();
    expect(steps?.items.find((item) => item.id === "wiki")?.href).toBe(
      "/wiki/Republic_of_Testland"
    );
  });

  it("needs real coordinates for the capital", async () => {
    const { caller } = setup({ capital: { coordinates: [] } });
    expect(doneById(await caller.getFirstSteps()).capital).toBe(false);
  });

  it("links each step to the console that owns it", async () => {
    const { caller } = setup();
    const hrefs = Object.fromEntries(
      ((await caller.getFirstSteps())?.items ?? []).map((item) => [item.id, item.href])
    );
    expect(hrefs).toEqual({
      budget: "/mycountry/economy?tab=fiscal",
      tax: "/mycountry/economy?tab=monetary",
      cabinet: "/mycountry/politics",
      wiki: "/wiki/Testland?action=edit",
      capital: "/mycountry/map-editor",
    });
  });

  it("reports a dismissed nation without looking anything up", async () => {
    const { caller, db } = setup({ country: { firstStepsDismissedAt: new Date(NOW - 1000) } });
    const steps = await caller.getFirstSteps();
    expect(steps).toEqual({ countryId: CALLER_COUNTRY, dismissed: true, recent: true, items: [] });
    expect(db.budgetAllocation.findFirst).not.toHaveBeenCalled();
    expect(shouldShowFirstSteps(steps)).toBe(false);
  });

  it("skips nations founded long ago", async () => {
    const old = new Date(NOW - FIRST_STEPS_WINDOW_MS - 60_000);
    const { caller } = setup({ country: { createdAt: old, ownedSince: old } });
    const steps = await caller.getFirstSteps();
    expect(steps).toMatchObject({ recent: false, items: [] });
    expect(shouldShowFirstSteps(steps)).toBe(false);
  });

  it("refuses another player's nation", async () => {
    const { caller } = setup();
    await expect(caller.getFirstSteps({ countryId: FOREIGN_COUNTRY })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("mycountry.dismissFirstSteps", () => {
  it("stores the dismissal on the nation without touching its updatedAt", async () => {
    const { caller, db } = setup();
    await expect(caller.dismissFirstSteps()).resolves.toEqual({ dismissed: true });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: { firstStepsDismissedAt: expect.any(Date), updatedAt: FOUNDED },
    });
  });

  it("refuses another player's nation", async () => {
    const { caller, db } = setup();
    await expect(caller.dismissFirstSteps({ countryId: FOREIGN_COUNTRY })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.country.update).not.toHaveBeenCalled();
  });
});

describe("mycountry.getWelcome", () => {
  it("summarises the active nation for the welcome page", async () => {
    const { caller, db } = setup();
    db.country.findUnique.mockResolvedValueOnce({
      id: CALLER_COUNTRY,
      name: "Testland",
      slug: "testland",
      flag: "https://example.com/flag.svg",
      currentPopulation: 12_400_000,
      realm: { name: "Ixnay" },
      nationalIdentity: { capitalCity: "Old Town", capitalCityRef: null },
      cities: [{ name: "Port Test" }],
    } as never);
    await expect(caller.getWelcome()).resolves.toEqual({
      id: CALLER_COUNTRY,
      name: "Testland",
      slug: "testland",
      flag: "https://example.com/flag.svg",
      realmName: "Ixnay",
      population: 12_400_000,
      capital: "Port Test",
    });
  });
});

describe("first steps rules", () => {
  it("dates a taken-over nation from when its owner got it", () => {
    const created = new Date("2020-01-01T00:00:00Z");
    const owned = new Date("2026-10-01T00:00:00Z");
    expect(foundedAt({ createdAt: created, ownedSince: owned })).toBe(owned);
    expect(foundedAt({ createdAt: owned, ownedSince: null })).toBe(owned);
  });

  it("reads map editor pairs and GeoJSON points as coordinates", () => {
    expect(hasMapCoordinates([1, 2])).toBe(true);
    expect(hasMapCoordinates({ type: "Point", coordinates: [1, 2] })).toBe(true);
    expect(hasMapCoordinates([Number.NaN, 2])).toBe(false);
    expect(hasMapCoordinates(null)).toBe(false);
  });

  it("ships a migration that adds the column the schema declares", () => {
    const sql = readFileSync(
      "prisma/migrations/20261025120000_mycountry_first_steps/migration.sql",
      "utf8"
    );
    expect(sql).toContain(
      'ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "firstStepsDismissedAt" TIMESTAMP(3);'
    );
    expect(readFileSync("prisma/schema/core.prisma", "utf8")).toMatch(
      /^\s+firstStepsDismissedAt\s+DateTime\?$/m
    );
  });
});
