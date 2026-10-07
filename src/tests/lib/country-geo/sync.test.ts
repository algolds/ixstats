import {
  syncCountryGeometryFromMapLayer,
  syncGeographicDemographics,
  unionRegionGeometries,
} from "~/lib/country-geo/sync";

const geometry = {
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

function dbWith(layer: object | null, more: object[] = []) {
  return {
    mapLayer: { findMany: jest.fn().mockResolvedValue(layer ? [layer, ...more] : []) },
    country: {
      findUnique: jest.fn().mockResolvedValue({ realmId: "r_eurth" }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

const square = (x: number, y: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

describe("syncCountryGeometryFromMapLayer", () => {
  it("copies the linked region's geometry, centroid, bounding box and area", async () => {
    const db = dbWith({
      geometry,
      centroid: [0.5, 0.5],
      boundingBox: [0, 0, 1, 1],
      areaSqKm: 1000,
    });
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: {
        geometry,
        centroid: [0.5, 0.5],
        boundingBox: [0, 0, 1, 1],
        landArea: 1000,
        areaSqMi: 386.102,
      },
    });
  });

  it("never overwrites the country's values with a region's missing ones (a baseline landArea survives)", async () => {
    const db = dbWith({ geometry, centroid: null, boundingBox: null, areaSqKm: null });
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.country.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { geometry } });
  });

  it("reads the nation's regions from its own realm's map only", async () => {
    const db = dbWith(null);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.mapLayer.findMany.mock.calls[0][0].where).toEqual({
      layerType: "political",
      countryId: "c1",
      isActive: true,
      realmId: "r_eurth",
    });
  });

  it("a nation with several regions gets their union, summed area, joint box and weighted centre", async () => {
    const db = dbWith(
      { geometry: square(0, 0), centroid: [0.5, 0.5], boundingBox: [0, 0, 1, 1], areaSqKm: 3000 },
      [
        {
          geometry: square(10, 0),
          centroid: [10.5, 0.5],
          boundingBox: [10, 0, 11, 1],
          areaSqKm: 1000,
        },
      ]
    );
    await syncCountryGeometryFromMapLayer(db, "c1");
    const data = db.country.update.mock.calls[0][0].data;
    expect(data.geometry.type).toBe("MultiPolygon");
    expect(data.geometry.coordinates).toHaveLength(2);
    expect(data).toMatchObject({
      centroid: [3, 0.5],
      boundingBox: [0, 0, 11, 1],
      landArea: 4000,
      areaSqMi: 4000 * 0.386102,
    });
  });

  it("touching regions merge into one outline with no inner border", () => {
    const merged = unionRegionGeometries([square(0, 0), square(1, 0)]);
    expect(merged?.type).toBe("Polygon");
    const xs = (merged as { coordinates: number[][][] }).coordinates[0]!.map((p) => p[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(2);
  });

  it("with no linked region (an unlink) still clears the cached geography", async () => {
    const db = dbWith(null);
    await syncCountryGeometryFromMapLayer(db, "c1");
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { geometry: null, centroid: null, boundingBox: null, landArea: null, areaSqMi: null },
    });
  });
});

describe("syncGeographicDemographics", () => {
  function demoDb(subs: { population: number | null; gdpContribution: number | null }) {
    return {
      country: {
        findUnique: jest.fn().mockResolvedValue({ geoRollupMode: "bottom-up" }),
        update: jest.fn().mockResolvedValue({}),
      },
      subdivision: { aggregate: jest.fn().mockResolvedValue({ _sum: subs }) },
      city: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { population: 5_000, gdpContribution: 9_000 } }),
      },
    };
  }

  it("rolls approved subdivisions up into the national figures", async () => {
    const db = demoDb({ population: 1000, gdpContribution: 4000 });
    await syncGeographicDemographics(db, "c1");
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { currentPopulation: 1000, currentTotalGdp: 4000, currentGdpPerCapita: 4 },
    });
  });

  it("does not overwrite national figures with the urban city total when there are no subdivisions", async () => {
    const db = demoDb({ population: null, gdpContribution: null });
    await syncGeographicDemographics(db, "c1");
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.city.aggregate).not.toHaveBeenCalled();
  });
});
