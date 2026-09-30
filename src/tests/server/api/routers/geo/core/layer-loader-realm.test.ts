/** @jest-environment node */
import { describe, it, expect, beforeEach } from "@jest/globals";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("fs/promises", () => ({ readFile: jest.fn() }));

import { readFile } from "fs/promises";
import { loadLayerFromDB, loadLayerWithFallback } from "~/server/api/routers/geo/core/layer-loader";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";

const readFileMock = readFile as unknown as jest.Mock;

const square = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

function row(featureId: string) {
  return {
    featureId,
    geometry: square,
    properties: {},
    displayName: featureId,
    countryId: null,
    areaSqKm: 1,
    centroid: [0.5, 0.5],
  };
}

function makeDb(rows: ReturnType<typeof row>[]) {
  return {
    mapLayer: { findMany: jest.fn().mockResolvedValue(rows) },
    countrySovereignty: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function whereOf(db: ReturnType<typeof makeDb>, call = 0) {
  return db.mapLayer.findMany.mock.calls[call][0].where;
}

describe("loadLayerFromDB is realm-scoped", () => {
  beforeEach(() => {
    clearLayerCache();
    readFileMock.mockReset();
  });

  it("filters the layer query by the requested realm", async () => {
    const db = makeDb([row("l1")]);
    await loadLayerFromDB(db, "lakes", 1, "r_eurth");

    expect(whereOf(db)).toMatchObject({ layerType: "lakes", isActive: true, realmId: "r_eurth" });
  });

  it("defaults to IxWorld when no realm is given", async () => {
    const db = makeDb([row("l1")]);
    await loadLayerFromDB(db, "lakes", 1);

    expect(whereOf(db)).toMatchObject({ realmId: DEFAULT_REALM_ID });
  });

  it("never serves one realm's cached layer to another realm", async () => {
    const db = makeDb([row("l1")]);
    await loadLayerFromDB(db, "lakes", 1, DEFAULT_REALM_ID);
    await loadLayerFromDB(db, "lakes", 1, "r_eurth");

    expect(db.mapLayer.findMany).toHaveBeenCalledTimes(2);
    expect(whereOf(db, 1)).toMatchObject({ realmId: "r_eurth" });
  });

  it("derives country labels from the same realm's political layer", async () => {
    const db = makeDb([row("Gallambria")]);
    const labels = await loadLayerFromDB(db, "country_labels", 1, "r_eurth");

    expect(whereOf(db)).toMatchObject({ layerType: "political", realmId: "r_eurth" });
    expect(labels?.features).toHaveLength(1);
  });
});

describe("loadLayerWithFallback: the static GeoJSON fallback is IxWorld's only", () => {
  beforeEach(() => {
    clearLayerCache();
    readFileMock.mockReset();
  });

  it("returns an empty FeatureCollection for another realm with no DB layer, without reading files", async () => {
    const db = makeDb([]);
    const fc = await loadLayerWithFallback(db, "political", 1, "r_eurth");

    expect(fc).toEqual({ type: "FeatureCollection", features: [] });
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("falls back to the static IxWorld file when IxWorld has no DB layer", async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ type: "FeatureCollection", features: [] }));
    const db = makeDb([]);
    const fc = await loadLayerWithFallback(db, "lakes", 1, DEFAULT_REALM_ID);

    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock.mock.calls[0][0]).toMatch(/lakes\.geojson$/);
    expect(fc?.type).toBe("FeatureCollection");
  });

  it("omits an IxWorld layer whose file is missing (null), as before", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));
    const db = makeDb([]);

    await expect(loadLayerWithFallback(db, "lakes", 1)).resolves.toBeNull();
  });

  it("prefers the realm's DB layer over any fallback", async () => {
    const db = makeDb([row("l1")]);
    const fc = await loadLayerWithFallback(db, "lakes", 1, "r_eurth");

    expect(fc?.features.length).toBeGreaterThan(0);
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
