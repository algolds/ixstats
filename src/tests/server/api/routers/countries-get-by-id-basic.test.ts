/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
/**
 * Plan 404: getByIdBasic is the small country profile ten screens (WikiOS among them) ask for.
 * It never selects or returns `geometry`, a polygon blob none of its callers read.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { identityProcedures } from "~/server/api/routers/countries/identity";

const row = {
  id: "c_1",
  name: "Aurelia",
  slug: "aurelia",
  flag: null,
  continent: "Eurth",
  currentPopulation: 1_000,
  currentGdpPerCapita: 2_000,
  currentTotalGdp: 3_000,
  landArea: 4_000,
  populationDensity: 5,
  centroid: [1, 2],
};

function caller(findMany: jest.Mock) {
  const ctx = {
    db: { country: { findMany }, realm: { findUnique: jest.fn().mockResolvedValue(null) } },
    user: null,
    auth: null,
    rateLimitIdentifier: "test",
    headers: new Headers(),
  } as never;
  return createCallerFactory(createTRPCRouter({ ...identityProcedures }))(ctx);
}

describe("countries.getByIdBasic (plan 404)", () => {
  it("does not select the geometry blob", async () => {
    const findMany = jest.fn().mockResolvedValue([row]);

    await caller(findMany).getByIdBasic({ id: "c_1" });

    const { select } = findMany.mock.calls[0]?.[0];
    expect(select).not.toHaveProperty("geometry");
    expect(select).toMatchObject({ id: true, name: true, centroid: true });
  });

  it("returns the profile without a geometry", async () => {
    const findMany = jest.fn().mockResolvedValue([row]);

    const country = await caller(findMany).getByIdBasic({ id: "c_1" });

    expect(country).toMatchObject({ id: "c_1", name: "Aurelia", centroid: [1, 2] });
    expect(country).not.toHaveProperty("geometry");
  });
});
