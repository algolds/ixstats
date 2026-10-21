/**
 * MyCountry after founding: the welcome summary and the "First steps" checklist, whose items tick
 * from the rows each console writes (never the rows founding itself wrote), and the per-nation
 * dismissal.
 */
import { myCountryFirstStepsRouter } from "~/server/api/routers/mycountry/first-steps";
import {
  FOUNDING_GRACE_MS,
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
