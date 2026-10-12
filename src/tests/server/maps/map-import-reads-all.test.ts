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

import { captureMapSnapshot } from "~/lib/maps/realm-map-snapshot";
import { realmNations } from "~/server/modules/maps/map-import.realm";
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
});
