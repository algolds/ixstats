/** @jest-environment node */
/**
 * PL-21: `editableByOwner: false` locks a subdivision, city, peak, river or lake against its country's owner;
 * admins can always edit it.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
jest.mock("~/lib/country-geo/sync", () => ({
  syncGeographicDemographics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/country-geo", () => ({
  upsertCity: jest.fn().mockResolvedValue({ id: "new-city", isNationalCapital: false }),
  upsertSubdivision: jest.fn().mockResolvedValue({ id: "new-sub" }),
  upsertPoi: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: jest.fn().mockResolvedValue(null),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { geoFeaturesCitiesRouter } from "~/server/api/routers/geo/features/cities";
import { geoFeaturesNamedFeaturesRouter } from "~/server/api/routers/geo/features/namedFeatures";
import { geoFeaturesSubdivisionsCrudRouter } from "~/server/api/routers/geo/features/subdivisions/crud";
import { geoFeaturesSubdivisionsGenerationRouter } from "~/server/api/routers/geo/features/subdivisions/generation";
import { countryGeoRouter } from "~/server/api/routers/countryGeo";
import { upsertCity } from "~/lib/country-geo";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = { id: "c1", name: "Aurelia", slug: "aurelia", flag: null };
const owner = {
  id: "u_owner",
  clerkUserId: "owner_1",
  countryId: "c1",
  role: { name: "user", level: 100 },
  country: COUNTRY,
};
const admin = {
  id: "u_admin",
  clerkUserId: "admin_1",
  countryId: null,
  role: { name: "admin", level: 10 },
  country: null,
};

const row = (editableByOwner: boolean) => ({
  id: "f1",
  countryId: "c1",
  name: "Feature",
  subdivisionId: null,
  isNationalCapital: false,
  coordinates: [0, 0],
  elevation: 100,
  prominence: null,
  wikiPageTitle: null,
  editableByOwner,
});

function model(found: unknown) {
  return {
    findFirst: jest.fn().mockResolvedValue(found),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: "f1", name: "Feature", subdivisionId: null }),
    delete: jest.fn().mockResolvedValue({}),
  };
}

function setup(found: unknown) {
  return {
    city: model(found),
    subdivision: model(found),
    peak: model(found),
    namedRiver: model(found),
    namedLake: model(found),
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

function ctx(db: unknown, user: typeof owner | typeof admin) {
  return createMockRouterContext({
    db,
    auth: { userId: user.clerkUserId },
    user,
    rateLimitIdentifier: `${user.clerkUserId}_${Math.random()}`,
  }) as never;
}

const cities = (db: unknown, user: typeof owner | typeof admin = owner) =>
  createCallerFactory(geoFeaturesCitiesRouter)(ctx(db, user));
const named = (db: unknown, user: typeof owner | typeof admin = owner) =>
  createCallerFactory(geoFeaturesNamedFeaturesRouter)(ctx(db, user));
const subdivisions = (db: unknown, user: typeof owner | typeof admin = owner) =>
  createCallerFactory(geoFeaturesSubdivisionsCrudRouter)(ctx(db, user));
const generation = (db: unknown, user: typeof owner | typeof admin = owner) =>
  createCallerFactory(geoFeaturesSubdivisionsGenerationRouter)(ctx(db, user));
const countryGeo = (db: unknown, user: typeof owner | typeof admin = owner) =>
  createCallerFactory(countryGeoRouter)(ctx(db, user));

const forbidden = { code: "FORBIDDEN", message: expect.stringMatching(/locked/) };

describe("map feature lock (PL-21) — geoFeatures", () => {
  beforeEach(() => jest.clearAllMocks());

  it("the owner cannot update or delete a locked city", async () => {
    const db = setup(row(false));
    await expect(
      cities(db).updateCity({ countryId: "c1", cityId: "f1", population: 5 })
    ).rejects.toMatchObject(forbidden);
    await expect(cities(db).deleteCity({ countryId: "c1", cityId: "f1" })).rejects.toMatchObject(
      forbidden
    );
    expect(db.city.update).not.toHaveBeenCalled();
    expect(db.city.delete).not.toHaveBeenCalled();
  });

  it("the owner can still edit an unlocked city", async () => {
    const db = setup(row(true));
    await cities(db).updateCity({ countryId: "c1", cityId: "f1", population: 5 });
    expect(db.city.update).toHaveBeenCalled();
  });

  it("an admin can edit and delete a locked city", async () => {
    const db = setup(row(false));
    await cities(db, admin).updateCity({ countryId: "c1", cityId: "f1", population: 5 });
    await cities(db, admin).deleteCity({ countryId: "c1", cityId: "f1" });
    expect(db.city.update).toHaveBeenCalled();
    expect(db.city.delete).toHaveBeenCalled();
  });

  it("the owner cannot delete a locked peak, river or lake", async () => {
    const db = setup(row(false));
    await expect(named(db).deletePeak({ countryId: "c1", peakId: "f1" })).rejects.toMatchObject(
      forbidden
    );
    await expect(
      named(db).deleteNamedRiver({ countryId: "c1", riverId: "f1" })
    ).rejects.toMatchObject(forbidden);
    await expect(
      named(db).deleteNamedLake({ countryId: "c1", lakeId: "f1" })
    ).rejects.toMatchObject(forbidden);
    await expect(
      named(db).updatePeak({ countryId: "c1", peakId: "f1", elevation: 200 })
    ).rejects.toMatchObject(forbidden);
    expect(db.peak.delete).not.toHaveBeenCalled();
    expect(db.namedRiver.delete).not.toHaveBeenCalled();
    expect(db.namedLake.delete).not.toHaveBeenCalled();
  });

  it("the owner cannot update or delete a locked subdivision", async () => {
    const db = setup(row(false));
    await expect(
      subdivisions(db).updateSubdivision({ countryId: "c1", subdivisionId: "f1", population: 1 })
    ).rejects.toMatchObject(forbidden);
    await expect(
      subdivisions(db).deleteSubdivision({ countryId: "c1", subdivisionId: "f1" })
    ).rejects.toMatchObject(forbidden);
    expect(db.subdivision.update).not.toHaveBeenCalled();
    expect(db.subdivision.delete).not.toHaveBeenCalled();
  });

  it("a topology cascade may not reshape a locked neighbouring subdivision", async () => {
    const db = setup(row(true));
    db.subdivision.findFirst
      .mockResolvedValueOnce(row(true))
      .mockResolvedValueOnce({ editableByOwner: false });
    await expect(
      subdivisions(db).updateSubdivision({
        countryId: "c1",
        subdivisionId: "f1",
        population: 1,
        cascadedNeighbors: [{ subdivisionId: "f2", geometry: { type: "Polygon" } }],
      })
    ).rejects.toMatchObject(forbidden);
    expect(db.subdivision.findFirst).toHaveBeenLastCalledWith({
      where: { id: { in: ["f2"] }, editableByOwner: false },
      select: { editableByOwner: true },
    });
    expect(db.subdivision.update).not.toHaveBeenCalled();
  });

  it("an owner's batch simplify leaves locked subdivisions out; an admin's includes them", async () => {
    const db = setup(null);
    await generation(db).simplifySubdivisions({ countryId: "c1" });
    expect(db.subdivision.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { countryId: "c1", editableByOwner: true } })
    );
    await generation(db, admin).simplifySubdivisions({ countryId: "c1" });
    expect(db.subdivision.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { countryId: "c1" } })
    );
  });
});

describe("map feature lock (PL-21) — countryGeo", () => {
  beforeEach(() => jest.clearAllMocks());

  it("upserting an existing locked city as owner is refused; creating a city is not", async () => {
    const db = setup({ editableByOwner: false });
    await expect(
      countryGeo(db).upsertCity({ countryId: "c1", id: "f1", name: "Feature" })
    ).rejects.toMatchObject(forbidden);
    expect(upsertCity).not.toHaveBeenCalled();

    await countryGeo(db).upsertCity({ countryId: "c1", name: "New town" });
    expect(upsertCity).toHaveBeenCalledTimes(1);
    await countryGeo(db, admin).upsertCity({ countryId: "c1", id: "f1", name: "Feature" });
    expect(upsertCity).toHaveBeenCalledTimes(2);
  });

  it("upserting an existing locked subdivision as owner is refused", async () => {
    const db = setup({ editableByOwner: false });
    await expect(
      countryGeo(db).upsertSubdivision({ countryId: "c1", id: "f1", population: 3 })
    ).rejects.toMatchObject(forbidden);
  });

  it("populating a locked city from the wiki as owner is refused before the wiki is read", async () => {
    const db = setup(row(false));
    await expect(
      countryGeo(db).populateFromWiki({ countryId: "c1", kind: "city", id: "f1" })
    ).rejects.toMatchObject(forbidden);
    expect(getArticleWikitext).not.toHaveBeenCalled();
  });
});
