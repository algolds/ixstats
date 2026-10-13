/** @jest-environment node */
/**
 * The map import's reads past the guarded client's 1000-row cap: a realm with more rows than that (Ixnay has 4068
 * altitude bands) is read whole, so a check, a snapshot or a roll back never works from part of a layer.
 * `fakeDb` answers at most 1000 rows to a findMany with no `take`, as src/server/db.ts does.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));

import type { Polygon } from "geojson";
import { mapImportApplySchema, type EngineResult } from "~/lib/maps/import/options";
import { writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";
import {
  captureMapSnapshot,
  heldSlots,
  restoreMapSnapshot,
  type MapImportSnapshot,
} from "~/lib/maps/realm-map-snapshot";
import { planMapImport } from "~/server/modules/maps/map-import.apply";
import { findImportRealm, realmNations } from "~/server/modules/maps/map-import.realm";
import { retirableSlots, unlinkedFeatures } from "~/server/modules/maps/world-import.slots";
import { fakeDb } from "./map-import-fakes";
import { mapRow } from "./world-import-fixtures";

const N = 1001;
const many = <T>(make: (i: number) => T) => Array.from({ length: N }, (_, i) => make(i));

describe("reads past the 1000-row cap", () => {
  it("captureMapSnapshot: every row of a layer", async () => {
    const db = fakeDb();
    db.mapLayer.rows.push(...many((i) => mapRow("political", `p${i}`, { countryId: `c${i}` })));
    db.country.rows.push(...many((i) => ({ id: `c${i}`, realmId: "r1" })));
    const snapshot = await captureMapSnapshot(db, "r1", [
      { layerType: "political", keys: [], wholeLayer: true, countryIds: [] },
    ]);
    expect(snapshot.rows).toHaveLength(N);
  });

  it("captureMapSnapshot: every country a replaced layer links", async () => {
    const db = fakeDb();
    db.mapLayer.rows.push(...many((i) => mapRow("political", `p${i}`, { countryId: `c${i}` })));
    db.country.rows.push(...many((i) => ({ id: `c${i}`, realmId: "r1" })));
    const keys = many((i) => `p${i}`);
    const snapshot = await captureMapSnapshot(db, "r1", [
      { layerType: "political", keys, wholeLayer: false, countryIds: [] },
    ]);
    expect(snapshot.rows).toHaveLength(N);
    expect(snapshot.countries).toHaveLength(N);
  });

  it("unlinkedFeatures: every political feature with no country", async () => {
    const db = fakeDb();
    db.mapLayer.rows.push(...many((i) => mapRow("political", `p${i}`)));
    expect(await unlinkedFeatures(db, "r1")).toHaveLength(N);
  });

  it("realmNations: every country of the realm", async () => {
    const db = fakeDb();
    db.country.rows.push(...many((i) => ({ id: `c${i}`, name: `Nation ${i}`, realmId: "r1" })));
    expect((await realmNations(db, "r1")).countries).toHaveLength(N);
  });

  it("retirableSlots: every generated slot nobody holds", async () => {
    const db = fakeDb();
    db.country.rows.push(
      ...many((i) => ({ id: `c${i}`, realmId: "r1", worldgen: true, ownerUserId: null }))
    );
    expect(await retirableSlots(db, "r1")).toHaveLength(N);
  });

  it("realmNations: every roster nation page of the realm", async () => {
    const db = fakeDb();
    db.realmPage.rows.push(
      ...many((i) => ({ id: `p${i}`, realmId: "r1", kind: "nation", title: `Page ${i}` }))
    );
    expect((await realmNations(db, "r1")).candidates).toHaveLength(N);
  });

  it("retirableSlots: a slot with a claim row or a blurb response past the 1000th is held", async () => {
    const db = fakeDb();
    db.country.rows.push(
      ...many((i) => ({ id: `c${i}`, realmId: "r1", worldgen: true, ownerUserId: null }))
    );
    db.realmClaim.rows.push(...many((i) => ({ id: `q${i}`, countryId: `c${i}` })));
    expect(await retirableSlots(db, "r1")).toEqual([]);
    db.realmClaim.rows.length = 0;
    db.blurbResponse.rows.push(...many((i) => ({ id: `b${i}`, countryId: `c${i}` })));
    expect(await retirableSlots(db, "r1")).toEqual([]);
  });
});

const ids = many((i) => `c${i}`);

describe("realm-map-snapshot: slots", () => {
  it("heldSlots: every owner and every claim", async () => {
    const owned = fakeDb();
    owned.country.rows.push(...ids.map((id) => ({ id, realmId: "r1", ownerUserId: "u1" })));
    expect((await heldSlots(owned, ids)).size).toBe(N);
    const claimed = fakeDb();
    claimed.realmClaim.rows.push(...ids.map((id, i) => ({ id: `q${i}`, countryId: id })));
    expect((await heldSlots(claimed, ids)).size).toBe(N);
  });

  const snapshot = (slots: MapImportSnapshot["slots"]): MapImportSnapshot => ({
    version: 1,
    realmId: "r1",
    rows: [],
    created: [],
    countries: [],
    slots,
  });

  it("a restore keeps and reopens every held slot the import created", async () => {
    const db = fakeDb();
    db.country.rows.push(
      ...ids.map((id) => ({ id, realmId: "r1", ownerUserId: "u1", claimable: true }))
    );
    const result = await restoreMapSnapshot(
      db,
      snapshot({ created: ids, retired: [], reserved: [] })
    );
    expect(result.slots).toMatchObject({ removed: 0, kept: N });
    expect(db.country.rows.filter((c: { claimable: boolean }) => c.claimable)).toHaveLength(N);
  });

  it("a restore puts back only the retired slots that are gone", async () => {
    const db = fakeDb();
    db.country.rows.push(...ids.map((id) => ({ id, realmId: "r1" })));
    const result = await restoreMapSnapshot(
      db,
      snapshot({ created: [], retired: ids.map((id) => ({ id })) as never, reserved: [] })
    );
    expect(result.slots?.restored).toBe(0);
    expect(db.country.rows).toHaveLength(N);
  });
});

describe("realm-map-writer", () => {
  it("links 1001 features to 1001 countries of the realm", async () => {
    const db = fakeDb();
    db.country.rows.push(...ids.map((id) => ({ id, realmId: "r1" })));
    const polygon: Polygon = {
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
    const features = ids.map((id) => ({ key: `f${id}`, geometry: polygon, countryId: id }));
    const written = await writeRealmMapFeatures(db, "r1", features, { syncCountryGeometry: false });
    expect(written.rejected.filter((r) => /not in this realm/.test(r.reason))).toEqual([]);
  });
});

describe("planMapImport", () => {
  const square = (x: number, y: number, size = 0.4): Polygon => ({
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
        [x, y],
      ],
    ],
  });
  const place = (i: number) => square(-170 + (i % 340), -80 + Math.floor(i / 340) * 2);
  const engine: EngineResult = {
    kind: "geojson",
    space: "lonlat",
    width: 360,
    height: 180,
    regions: many((i) => ({ key: `k${i}`, name: `Nation ${i}` })),
    features: {
      type: "FeatureCollection",
      features: many((i) => ({
        type: "Feature" as const,
        properties: { key: `k${i}` },
        geometry: place(i),
      })),
    },
    report: { log: [], warnings: [], timingsMs: {} },
  };
  const apply = (mode: "merge" | "replace") =>
    mapImportApplySchema.parse({
      mode,
      mapping: Object.fromEntries(many((i) => [`k${i}`, `Nation ${i}`])),
    });

  it("compares every border the realm has with the import's", async () => {
    const db = fakeDb();
    db.realm.rows.push({ id: "r1", slug: "eurth", name: "Eurth", ownerId: "f", settings: {} });
    db.mapLayer.rows.push(
      ...many((i) => mapRow("political", `Nation ${i}`, { displayName: `Nation ${i}` }))
    );
    const plan = await planMapImport(
      db,
      await findImportRealm(db, "r1"),
      engine,
      apply("merge"),
      {}
    );
    expect(plan.diff.features).toHaveLength(N);
    expect(plan.diff.features.filter((f) => f.status === "new")).toEqual([]);
  });

  it("lists every political feature a replace retires", async () => {
    const db = fakeDb();
    db.realm.rows.push({ id: "r1", slug: "eurth", name: "Eurth", ownerId: "f", settings: {} });
    db.mapLayer.rows.push(...many((i) => mapRow("political", `Old ${i}`)));
    const plan = await planMapImport(
      db,
      await findImportRealm(db, "r1"),
      engine,
      apply("replace"),
      {}
    );
    expect(plan.diff.removed).toHaveLength(N);
  });
});
