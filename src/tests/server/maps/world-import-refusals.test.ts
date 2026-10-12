/** @jest-environment node */
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
import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { findImportRealm, MapImportError } from "~/server/modules/maps/map-import.realm";
import { runWorldDryRun } from "~/server/modules/maps/world-import";
import { prepareWorld } from "~/server/modules/maps/world-import.prepare";
import { fakeDb } from "./map-import-fakes";
import {
  feature,
  jobFor,
  makeBundle,
  seedRealm,
  slot,
  square,
  stateOf,
  stored,
  type BundleOptions,
} from "./world-import-fixtures";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-import-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

describe("the dry run's refusals (Review Focus 3)", () => {
  const refused = async (options: BundleOptions, pattern: RegExp, db = seedRealm()) => {
    const before = stateOf(db);
    const job = jobFor(await stored(options));
    await expect(runWorldDryRun(db, job)).rejects.toThrow(pattern);
    await expect(runWorldDryRun(db, job)).rejects.toBeInstanceOf(MapImportError);
    expect(stateOf(db)).toBe(before);
  };

  it("refuses a seed the realm's column cannot hold", async () => {
    await refused({ seed: 5_000_000_000 }, /32-bit seed/);
  });

  it("refuses a slot with no territory, and a territory claimed twice", async () => {
    const slots = [slot(1), slot(2)];
    await refused(
      { slots, political: [feature(square(0), { slotKey: "slot_1" }, 1)] },
      /slot_2 has no territory/
    );
    await refused(
      {
        slots,
        political: [
          feature(square(0), { slotKey: "slot_1" }, 1),
          feature(square(4), { slotKey: "slot_1" }, 2),
          feature(square(8), { slotKey: "slot_2" }, 3),
        ],
      },
      /slot_1 has two political features/
    );
  });

  it("refuses two features of one layer with the same key", async () => {
    const line = {
      type: "LineString" as const,
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    };
    await refused(
      { layers: { rivers: [feature(line, {}, 7), feature(line, {}, 7)] } },
      /rivers has two features keyed 7/
    );
  });

  it("refuses a GDP per capita outside the development level's range", async () => {
    await refused(
      { slots: [slot(1, { gdpPerCapita: 40_000 })] },
      /GDP per capita 40,000 is outside/
    );
    await refused({ slots: [slot(1, { gdpPerCapita: 9_000 })] }, /Nation 1: GDP per capita 9,000/);
    // the same figure is fine at another level, and 0 (an empty slot) always is
    const db = seedRealm();
    const modern = await stored({
      params: { developmentLevel: "modern" },
      slots: [slot(1, { gdpPerCapita: 40_000 }), slot(2, { gdpPerCapita: 0 })],
    });
    expect(await runWorldDryRun(db, jobFor(modern))).toBeTruthy();
  });

  describe("with PostGIS", () => {
    type Item = { id: string; g: { type: string } };
    beforeEach(() => jest.mocked(isPostGISAvailable).mockResolvedValue(true));
    afterEach(() => jest.mocked(isPostGISAvailable).mockResolvedValue(false));

    /** What the inspection SQL would answer; `area` is the measured area in km2 of the polygon with that id. */
    const postgis = (
      db: ReturnType<typeof fakeDb>,
      answer: (item: Item) => { valid?: boolean; repairable?: boolean; fail?: boolean } = () => ({})
    ) => {
      db.$queryRawUnsafe.mockImplementation(async (sql: string, json: string) => {
        if (!sql.includes("ST_IsValid")) return [];
        const items = JSON.parse(json) as Item[];
        return items.map((item) => {
          const a = answer(item);
          if (a.fail) throw new Error("transform: latitude or longitude exceeded limits");
          return {
            id: item.id,
            valid: a.valid ?? true,
            repairable: a.repairable ?? true,
            area: item.g.type === "LineString" ? 0 : 49_000,
          };
        });
      });
    };

    it("refuses a population more than the measured area can hold, and checks nothing of it without PostGIS", async () => {
      // PostGIS measures every shape here as 49,000 km2: at most 110 people a km2 at the industrial level, with a
      // quarter of slack for the smoothed border being smaller than the cells the browser counted (6,737,500)
      const crowded = { slots: [slot(1, { population: 7_000_000 })] };
      const db = seedRealm();
      postgis(db);
      await refused(
        crowded,
        /Nation 1: population 7,000,000 is more than its 49,000 km² can hold/,
        db
      );
      // 120 a km2 of the measured border: a full-density slot whose smoothed border came out smaller
      const ok = seedRealm();
      postgis(ok);
      expect(
        await runWorldDryRun(
          ok,
          jobFor(await stored({ slots: [slot(1, { population: 5_880_000 })] }))
        )
      ).toBeTruthy();
      jest.mocked(isPostGISAvailable).mockResolvedValue(false);
      expect(await runWorldDryRun(seedRealm(), jobFor(await stored(crowded)))).toBeTruthy();
    });

    it("refuses a nation's border nothing is left of once its self-crossing is repaired, naming it", async () => {
      const db = seedRealm();
      postgis(db, (item) => ({ valid: false, repairable: item.id !== "political:slot_2" }));
      const before = stateOf(db);
      await expect(runWorldDryRun(db, jobFor(await stored()))).rejects.toThrow(
        /political slot_2: nothing is left of it once its self-crossing is repaired/
      );
      expect(stateOf(db)).toBe(before);
    });

    it("leaves out a river, lake or contour nothing is left of, with a warning, as the writer would", async () => {
      const db = seedRealm();
      postgis(db, (item) => ({ repairable: item.id !== "altitudes:1" }));
      const id = await stored();
      const diff = await runWorldDryRun(db, jobFor(id));
      expect(diff.layers.altitudes).toEqual({ create: 0, change: 0, retire: 0 });
      expect(diff.layers.climate.create).toBe(1);
      expect(diff.warnings).toContain(
        "1 altitudes shapes are too small or tangled to keep and are left out"
      );
    });

    it("accepts a self-crossing outline the writer can repair, with a warning", async () => {
      const db = seedRealm();
      postgis(db, (item) => ({ valid: !item.id.startsWith("political:") }));
      const diff = await runWorldDryRun(db, jobFor(await stored()));
      expect(diff.warnings).toContain(
        "3 political outlines cross themselves and are repaired when written"
      );
      expect(diff.warnings).not.toContain(
        "PostGIS is not available, so the geometry and the nations' populations were not checked"
      );
    });

    it("refuses a feature PostGIS cannot project to Web Mercator, naming only that one", async () => {
      const db = seedRealm();
      postgis(db, (item) => ({ fail: item.id === "climate:1" }));
      await expect(runWorldDryRun(db, jobFor(await stored()))).rejects.toThrow(
        /climate 1: PostGIS cannot project or measure it \(transform: latitude or longitude exceeded limits\)/
      );
      // the other features of the same batch were retried one by one and did not fail
      const error = await runWorldDryRun(db, jobFor(await stored())).catch((e: Error) => e);
      expect((error as Error).message).not.toMatch(/political|background|altitudes|rivers/);
    });

    it("measures each nation's land area from PostGIS, not from the bundle", async () => {
      const db = seedRealm();
      postgis(db);
      const bundle = makeBundle({ slots: [slot(1, { areaKm2: 1 })] });
      const prepared = await prepareWorld(db, await findImportRealm(db, "r1"), bundle);
      expect(prepared.slots.map((s) => s.areaKm2)).toEqual([49_000]);
    });
  });
});
