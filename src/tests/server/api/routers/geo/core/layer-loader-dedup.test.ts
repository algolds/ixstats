import { describe, it, expect, beforeEach } from "@jest/globals";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { loadLayerFromDB } from "~/server/api/routers/geo/core/layer-loader";
import { clearLayerCache } from "~/server/shared/layer-cache";

const row = {
  featureId: "l1",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
  properties: {},
  displayName: "L",
  countryId: null,
  areaSqKm: 1,
  centroid: null,
};

function makeDb(findMany: jest.Mock) {
  return { mapLayer: { findMany } };
}

async function resolvedRows() {
  await Promise.resolve();
  return [row];
}

describe("loadLayerFromDB in-flight dedup", () => {
  beforeEach(() => {
    clearLayerCache();
  });

  it("concurrent loads of the same layer hit the DB once", async () => {
    const findMany = jest.fn(resolvedRows);
    const db = makeDb(findMany);

    const [a, b] = await Promise.all([
      loadLayerFromDB(db, "lakes", 1),
      loadLayerFromDB(db, "lakes", 1),
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("a failed load does not poison later calls", async () => {
    const findMany = jest.fn(resolvedRows).mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const db = makeDb(findMany);

    await expect(loadLayerFromDB(db, "lakes", 1)).rejects.toThrow("db down");
    await expect(loadLayerFromDB(db, "lakes", 1)).resolves.not.toBeNull();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("clearLayerCache drops in-flight entries", async () => {
    const findMany = jest.fn(resolvedRows);
    const db = makeDb(findMany);

    const first = loadLayerFromDB(db, "lakes", 1);
    clearLayerCache("lakes");
    const second = loadLayerFromDB(db, "lakes", 1);

    await Promise.all([first, second]);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
