/** @jest-environment node */
/**
 * The roster import (Ixnay only) rewrites the continent and region of the nations it replaces (it matches them by
 * name), which the political layer reads: it moves Ixnay's map version when one changed, and only then.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/admin/roster-parser", () => ({ parseRosterFile: jest.fn() }));
jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { parseRosterFile } from "~/lib/admin/roster-parser";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { adminCountriesImportRouter } from "~/server/api/routers/admin/countries/import";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const EXISTING = {
  id: "c_gal",
  name: "Gallambria",
  continent: "Aurelia",
  region: "North",
  realmId: DEFAULT_REALM_ID,
  baselinePopulation: 1_000_000,
  baselineGdpPerCapita: 10_000,
  currentPopulation: 1_000_000,
  currentGdpPerCapita: 10_000,
};

const rosterRow = (overrides: object = {}) => ({
  country: "Gallambria",
  continent: "Aurelia",
  region: "North",
  population: 1_000_000,
  gdpPerCapita: 10_000,
  ...overrides,
});

function importWith(row: object, replaceExisting: boolean) {
  (parseRosterFile as jest.Mock).mockResolvedValue([row]);
  const db = createMockPrisma();
  db.country.findMany.mockResolvedValue([EXISTING]);
  db.country.update.mockImplementation(async ({ data }: { data: object }) => ({
    ...EXISTING,
    ...data,
  }));
  const caller = createCallerFactory(adminCountriesImportRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "admin_1" },
      user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    }) as never
  );
  const run = () =>
    caller.importRosterData({ analysisId: "a", replaceExisting, fileData: [1], fileName: "r.csv" });
  return { db, run };
}

beforeEach(() => jest.clearAllMocks());

describe("importRosterData and Ixnay's map version", () => {
  it.each([
    ["continent", { continent: "Boreas" }],
    ["region", { region: "South" }],
  ])("a replaced nation with a new %s moves it", async (_field, change) => {
    const { db, run } = importWith(rosterRow(change), true);
    await expect(run()).resolves.toMatchObject({ success: true, updated: 1, errors: [] });
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    const [passedDb, realmId] = jest.mocked(invalidateRealmMap).mock.calls[0]!;
    expect(realmId).toBe(DEFAULT_REALM_ID);
    expect(passedDb === (db as never)).toBe(true);
  });

  it("a replaced nation with the same name, continent and region does not", async () => {
    const { run } = importWith(rosterRow({ population: 2_000_000 }), true);
    await expect(run()).resolves.toMatchObject({ success: true, updated: 1 });
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });

  it("an update that only changes figures does not", async () => {
    const { run } = importWith(rosterRow({ continent: "Boreas", population: 2_000_000 }), false);
    await expect(run()).resolves.toMatchObject({ success: true, updated: 1 });
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });

  it("a failed bump is reported among the import's errors, not as a failed import", async () => {
    jest.mocked(invalidateRealmMap).mockRejectedValueOnce(new Error("db down"));
    const { run } = importWith(rosterRow({ continent: "Boreas" }), true);
    const result = await run();
    expect(result).toMatchObject({ success: true, updated: 1 });
    expect(result.errors).toEqual(["Map version bump failed: db down"]);
  });
});
