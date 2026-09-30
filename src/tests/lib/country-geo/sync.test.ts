import {
  syncCountryGeometryFromMapLayer,
  syncGeographicDemographics,
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

function dbWith(layer: object | null) {
  return {
    mapLayer: { findFirst: jest.fn().mockResolvedValue(layer) },
    country: { update: jest.fn().mockResolvedValue({}) },
  };
}

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
