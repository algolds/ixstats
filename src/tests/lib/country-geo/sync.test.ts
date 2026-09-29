import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo/sync";

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
