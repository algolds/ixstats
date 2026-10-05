/** @jest-environment node */
/** AT-18: country names are unique per realm only, so the flag lookup by name is realm-scoped. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/flags/server", () => ({
  serverFlagResolver: { resolveBatch: jest.fn().mockResolvedValue(new Map()) },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { flagsProcedures } from "~/server/api/routers/countries/flags";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(flagsProcedures);

function countryWhere(db: ReturnType<typeof createMockPrisma>) {
  return db.country.findMany.mock.calls[0]![0].where;
}

describe("countries.flags.resolveBatch realm scope", () => {
  it("looks names up in the viewer's active realm", async () => {
    const db = createMockPrisma();
    db.country.findMany.mockResolvedValue([]);
    const ctx = createMockRouterContext({
      db,
      user: { clerkUserId: "u1", country: { id: "c1", name: "A", slug: "a", realmId: "eurth" } },
    });
    await createCaller(ctx as never).resolveBatch({ countryNames: ["Atlantis"] });

    expect(countryWhere(db)).toEqual({ name: { in: ["Atlantis"] }, realmId: "eurth" });
  });

  it("defaults an anonymous viewer to IxWorld", async () => {
    const db = createMockPrisma();
    db.country.findMany.mockResolvedValue([]);
    const ctx = createMockRouterContext({ db, auth: null, user: null });
    await createCaller(ctx as never).resolveBatch({ countryNames: ["Atlantis"] });

    expect(countryWhere(db)).toEqual({ name: { in: ["Atlantis"] }, realmId: "default" });
  });

  it("uses the realm named by ?realm=", async () => {
    const db = createMockPrisma();
    db.country.findMany.mockResolvedValue([]);
    db.realm.findUnique.mockResolvedValue({ id: "realm_eurth" });
    const ctx = createMockRouterContext({ db, auth: null, user: null });
    await createCaller(ctx as never).resolveBatch({ countryNames: ["Atlantis"], realm: "eurth" });

    expect(countryWhere(db)).toEqual({ name: { in: ["Atlantis"] }, realmId: "realm_eurth" });
  });
});
