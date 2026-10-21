/** @jest-environment node */
/**
 * The `map-tiles` cron job: when a realm's map version has no `.done` marker, render the low zooms (z0-3) of
 * altitudes, rivers and lakes once, mark the version done, and remove folders of versions a day after a newer
 * one was ready.
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const buildTile = jest.fn();
jest.mock("~/server/modules/maps/tile-render", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));
import { runMapTilePrerender } from "~/server/modules/maps/tile-prerender";

interface Realm {
  id: string;
  status: string;
  mapVersion: number;
}

/** 3 layers x (1 + 4 + 16 + 64) tiles */
const LOW_ZOOM_TILES = 3 * 85;

function fakeDb(realms: Realm[]): never {
  return { realm: { findMany: jest.fn(async () => realms) }, $queryRawUnsafe: jest.fn() } as never;
}

let root: string;
beforeEach(() => {
  jest.clearAllMocks();
  root = mkdtempSync(path.join(tmpdir(), "map-tiles-cron-"));
  process.env.MAP_TILE_DIR = root;
  buildTile.mockResolvedValue(new Uint8Array([1]));
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_TILE_DIR;
  jest.restoreAllMocks();
});

const IXNAY: Realm = { id: "default", status: "active", mapVersion: 4 };

describe("runMapTilePrerender", () => {
  it("never renders a system realm (they have no map)", async () => {
    const findMany = jest.fn().mockResolvedValue([IXNAY]);
    await runMapTilePrerender({ realm: { findMany }, $queryRawUnsafe: jest.fn() } as never);
    expect(findMany).toHaveBeenCalledWith({
      where: { isSystem: false },
      select: { id: true, status: true, mapVersion: true },
    });
  });
  it("renders a version exactly once: a second run finds the marker and renders nothing", async () => {
    await runMapTilePrerender(fakeDb([IXNAY]));
    buildTile.mockClear();
    const result = await runMapTilePrerender(fakeDb([IXNAY]));
    expect(buildTile).not.toHaveBeenCalled();
    expect(result).toMatchObject({ rendered: 0, versionsCompleted: 0 });
  });
  it("renders only published realms and Ixnay: a draft or generating realm's tiles wait for a viewer", async () => {
    await runMapTilePrerender(
      fakeDb([
        { id: "r_draft", status: "draft", mapVersion: 1 },
        { id: "r_gen", status: "generating", mapVersion: 1 },
        { id: "r_live", status: "active", mapVersion: 1 },
        { id: "r_old", status: "archived", mapVersion: 1 },
      ])
    );
    const realms = new Set(buildTile.mock.calls.map(([, realm]) => realm));
    expect(realms).toEqual(new Set(["r_live", "r_old"]));
    expect(readdirSync(root).sort()).toEqual(["r_live", "r_old"]);
  });

  it("carries on after a tile fails: the others are stored, the version is not marked, and the next run finishes it", async () => {
    buildTile.mockImplementation(
      async (_db, _realm, layer: string, z: number, x: number, y: number) => {
        if (layer === "rivers" && z === 2 && x === 1 && y === 1) throw new Error("db down");
        return new Uint8Array([2]);
      }
    );
    const first = await runMapTilePrerender(fakeDb([IXNAY]));
    expect(first).toMatchObject({ rendered: LOW_ZOOM_TILES - 1, failed: 1, versionsCompleted: 0 });
    expect(existsSync(path.join(root, "default", "f1", "4", ".done"))).toBe(false);

    buildTile.mockClear();
    buildTile.mockResolvedValue(new Uint8Array([2]));
    const second = await runMapTilePrerender(fakeDb([IXNAY]));
    // Only the failed tile is rendered again
    expect(buildTile).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ rendered: 1, failed: 0, versionsCompleted: 1 });
    expect(existsSync(path.join(root, "default", "f1", "4", ".done"))).toBe(true);
  });
  it("stops between tiles when the budget is spent, without marking the version, and continues next run", async () => {
    let clock = 0;
    const options = { budgetMs: 1_000, now: () => clock };
    buildTile.mockImplementation(async () => {
      clock += 100;
      return new Uint8Array([1]);
    });
    const first = await runMapTilePrerender(fakeDb([IXNAY]), options);
    expect(first.rendered).toBe(10);
    expect(first.versionsCompleted).toBe(0);
    expect(existsSync(path.join(root, "default", "f1", "4", ".done"))).toBe(false);

    clock = 0;
    buildTile.mockClear();
    await runMapTilePrerender(fakeDb([IXNAY]), { budgetMs: 1_000_000, now: () => clock });
    expect(buildTile).toHaveBeenCalledTimes(LOW_ZOOM_TILES - 10);
    expect(existsSync(path.join(root, "default", "f1", "4", ".done"))).toBe(true);
  });
});
