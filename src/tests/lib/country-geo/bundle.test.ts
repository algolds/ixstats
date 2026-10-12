import { getCountryGeoBundle } from "~/lib/country-geo/bundle";

const outline = { type: "Polygon", coordinates: [[[0, 0]]] };

function makeDb({
  layer,
  realm = { realmId: "r_eurth", realm: { slug: "eurth" } },
}: {
  layer: object | null;
  realm?: { realmId: string; realm: { slug: string } | null };
}) {
  const countryRow = {
    ...realm,
    id: "c1",
    name: "Caphiria",
    slug: "caphiria",
    currentPopulation: 1000,
    currentTotalGdp: 5000,
    geoRollupMode: "hybrid",
    centroid: { coordinates: [3, 4] },
    boundingBox: [0, 0, 6, 8],
    landArea: 77,
    areaSqMi: 30,
  };
  return {
    country: {
      findUnique: jest.fn(async ({ select }: { select: Record<string, boolean> }) =>
        select.geometry ? { ...countryRow, geometry: outline } : countryRow
      ),
    },
    mapLayer: { findFirst: jest.fn().mockResolvedValue(layer) },
    subdivision: { findMany: jest.fn().mockResolvedValue([]) },
    city: { findMany: jest.fn().mockResolvedValue([]) },
    pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
    storyPin: { findMany: jest.fn().mockResolvedValue([]) },
    mapLabel: { findMany: jest.fn().mockResolvedValue([]) },
    countryGeoProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
}

const layerRow = {
  id: "ml1",
  featureId: "Caphiria",
  displayName: "Caphiria",
  geometry: { type: "Polygon", coordinates: [[[1, 1]]] },
  centroid: { coordinates: [1, 2] },
  boundingBox: [0, 0, 2, 2],
  areaSqKm: 12,
};

describe("getCountryGeoBundle queries", () => {
  it("finds neighbours with a plain ST_Intersects the GiST index can serve (no ST_MakeValid)", async () => {
    const db = makeDb({ layer: layerRow });
    await getCountryGeoBundle(db, "c1");

    const sql = db.$queryRawUnsafe.mock.calls[0]![0] as string;
    expect(sql).toContain("ST_Intersects(ml1.geom_postgis, ml2.geom_postgis)");
    expect(sql).not.toContain("ST_MakeValid");
  });

  it("reads the outline once: from the map layer when it has one, so not from the country as well", async () => {
    const db = makeDb({ layer: layerRow });
    const bundle = await getCountryGeoBundle(db, "c1");

    expect(db.country.findUnique).toHaveBeenCalledTimes(1);
    expect(db.country.findUnique.mock.calls[0]![0].select).not.toHaveProperty("geometry");
    expect(bundle.geometry).toEqual(layerRow.geometry);
  });

  it("names the country's realm by slug, so a viewer of another realm can load that realm's layers", async () => {
    const db = makeDb({ layer: layerRow });
    const bundle = await getCountryGeoBundle(db, "c1");

    expect(db.country.findUnique.mock.calls[0]![0].select).toMatchObject({
      realmId: true,
      realm: { select: { slug: true } },
    });
    expect(bundle.country.realmSlug).toBe("eurth");
  });

  it("names Ixnay's slug for a country of Ixnay, whose realm row may not be there", async () => {
    const db = makeDb({ layer: layerRow, realm: { realmId: "default", realm: null } });
    const bundle = await getCountryGeoBundle(db, "c1");

    expect(bundle.country.realmSlug).toBe("ixnay");
  });

  it("selects only the map layer columns the bundle uses", async () => {
    const db = makeDb({ layer: layerRow });
    await getCountryGeoBundle(db, "c1");

    const select = db.mapLayer.findFirst.mock.calls[0]![0].select;
    expect(Object.keys(select).sort()).toEqual(
      ["areaSqKm", "boundingBox", "centroid", "displayName", "featureId", "geometry", "id"].sort()
    );
  });

  it("falls back to the country's own outline when it has no map layer", async () => {
    const db = makeDb({ layer: null });
    const bundle = await getCountryGeoBundle(db, "c1");

    expect(db.country.findUnique).toHaveBeenCalledTimes(2);
    expect(bundle.geometry).toEqual(outline);
    expect(bundle.areaSqKm).toBe(77);
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("falls back to the country's outline when the layer row has none", async () => {
    const db = makeDb({ layer: { ...layerRow, geometry: null } });
    const bundle = await getCountryGeoBundle(db, "c1");

    expect(bundle.geometry).toEqual(outline);
  });
});
