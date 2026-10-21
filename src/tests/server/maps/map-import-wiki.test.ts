/** @jest-environment node */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
const fetchOriginal = jest.fn();
jest.mock("~/server/modules/realms/realms.wiki", () => {
  class RealmWikiError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
  return {
    RealmWikiError,
    fetchChosenWikiMapOriginal: (...args: unknown[]) => fetchOriginal(...args),
  };
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startWikiMapImport } from "~/server/modules/maps/map-import.wiki";
import { RealmWikiError } from "~/server/modules/realms/realms.wiki";
import { admin, fakeDb, stranger } from "./map-import-fakes";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "map-wiki-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

function setup() {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    ownerId: "founder_1",
    settings: {
      map: {
        source: "iiwiki",
        attribution: "Map by A. Cartographer (CC BY-SA)",
        bounds: { west: -180, south: -60, east: 180, north: 80 },
      },
    },
  });
  return db;
}

describe("Import this map (from the realm's wiki)", () => {
  it("passes on the wiki's refusal when the file changed since it was chosen", async () => {
    const db = setup();
    fetchOriginal.mockRejectedValue(
      new (RealmWikiError as never as new (c: string, m: string) => Error)(
        "CONFLICT",
        "The wiki's file changed"
      )
    );
    await expect(startWikiMapImport(db, admin, "r1", { kick: false })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.mapImportJob.rows).toHaveLength(0);
  });

  it("is only for the realm's map staff", async () => {
    const db = setup();
    fetchOriginal.mockClear();
    await expect(startWikiMapImport(db, stranger, "r1", { kick: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fetchOriginal).not.toHaveBeenCalled();
  });
});
