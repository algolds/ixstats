/** @jest-environment node */
/**
 * A world import in a realm with more than 1000 nations (the guarded client answers a findMany with no `take` at
 * 1000 rows; `fakeDb` does the same): the check and the apply read every country, so a held slot is kept and closed,
 * and a new nation's name is made unique among all of them.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyWorld, runWorldDryRun } from "~/server/modules/maps/world-import";
import { jobFor, relief, seedRealm, stored } from "./world-import-fixtures";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-import-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

const HELD = 1001;

/** The seeded realm plus 1001 generated slots nobody owns but a claim row holds, the last named like a new nation. */
function crowdedRealm() {
  const db = seedRealm();
  for (let i = 0; i < HELD; i++) {
    db.country.rows.push({
      id: `held${i}`,
      name: i === HELD - 1 ? "Nation 3" : `Held ${i}`,
      slug: `held-${i}`,
      realmId: "r1",
      worldgen: true,
      claimable: true,
      ownerUserId: null,
    });
    db.realmClaim.rows.push({
      id: `q_held${i}`,
      realmId: "r1",
      countryId: `held${i}`,
      status: "withdrawn",
    });
  }
  return db;
}

describe("a world import in a realm with more than 1000 nations", () => {
  it("the check counts every kept slot as reserved and every taken name", async () => {
    const diff = await runWorldDryRun(crowdedRealm(), jobFor(await stored()));
    // c_old2 (a withdrawn claim) and the 1001 held slots; Nation 2 (c_manual) and Nation 3 (the last held slot)
    expect(diff.slots).toMatchObject({ retire: 1, reserved: HELD + 1, renamed: 2 });
  });

  it("the apply closes every kept slot and numbers a name the last nation holds", async () => {
    const db = crowdedRealm();
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    const open = db.country.rows.filter(
      (c: { id: string; claimable: boolean }) => c.id.startsWith("held") && c.claimable
    );
    expect(open).toEqual([]);
    const names = db.country.rows.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Nation 3", "Nation 3 (2)"]));
  });
});
