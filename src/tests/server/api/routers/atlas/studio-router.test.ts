/** @jest-environment node */
/**
 * atlas.studio.realmMeasures: site admins only; answers with a reason, not an error, for a realm without a map.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { atlasStudioRouter } from "~/server/api/routers/atlas/studio";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, fakeDb, founder } from "~/tests/server/maps/map-import-fakes";

function caller(user: typeof admin) {
  const db = fakeDb();
  db.realm.rows.push({ id: "empty", slug: "empty", name: "Empty", mapVersion: 1, settings: null });
  const api = createCallerFactory(atlasStudioRouter)(
    createMockRouterContext({
      db,
      auth: { userId: user.clerkUserId },
      user: { ...user, country: null },
    }) as never
  );
  return api;
}

describe("atlas.studio.realmMeasures", () => {
  it("lets a site admin read a realm's measures", async () => {
    const result = await caller(admin).realmMeasures({ realm: "empty" });
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/no map layers/i) });
  });

  it("refuses everyone else", async () => {
    await expect(caller(founder).realmMeasures({ realm: "empty" })).rejects.toMatchObject({
      // the middleware throws an AppError, which the caller wraps
      cause: { code: "FORBIDDEN" },
    });
  });
});
