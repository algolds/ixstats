/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/server/modules/realms/realms.prefill", () => ({
  fetchNationPagePrefill: jest.fn(),
  EMPTY_PREFILL: { country: {}, identity: {} },
}));
const mockLock = { held: false };
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) =>
    mockLock.held ? { ran: false } : { ran: true, result: await fn() }
  ),
}));

jest.mock("~/lib/maps/realm-map-writer", () => ({
  writeRealmMapFeatures: jest.fn(
    async (_db: unknown, _realm: string, features: Array<{ key: string }>) => ({
      written: features.map((f) => f.key),
      rejected: [],
      areas: Object.fromEntries(features.map((f) => [f.key, 1234])),
    })
  ),
}));
jest.mock("~/lib/maps/realm-layer-repair", () => ({
  repairRealmLayer: jest.fn().mockResolvedValue({
    plan: { smoothing: { status: "smooth" } },
    written: { written: ["A"], smoothed: 1, rejected: [] },
    mapImportId: "imp1",
  }),
}));
jest.mock("~/lib/maps/adjacency", () => ({
  rebuildAdjacency: jest.fn().mockResolvedValue({ skipped: true }),
}));
jest.mock("~/server/shared/map-invalidation", () => ({
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));

import fs from "node:fs";
import path from "node:path";
import { realmsRouter } from "~/server/api/routers/realms";
import { sourcePreset } from "~/lib/realms/sources/presets";
import { withJobLock } from "~/lib/system/job-lock";
import {
  runDueSourceSyncs,
  runSourceSync,
  sourceSyncLockName,
} from "~/server/modules/realms/realms.source-sync";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { SyncPlan } from "~/lib/realms/sources/plan";
import { applySyncPlan } from "~/server/modules/realms/realms.source-apply";
import { DEFAULT_SYNC_OPTIONS } from "~/lib/realms/sources/config";
import { buildSyncPlan, type SourceSyncConfig } from "~/server/modules/realms/realms.source-sync";

const FIXTURES = path.resolve(__dirname, "../../fixtures/realm-sources/eurth-map");
const fixtureFiles: Record<string, string> = {
  "eurth-map/src/data/nations.js": fs.readFileSync(path.join(FIXTURES, "nations.js"), "utf8"),
  "eurth-map/src/data/organizations.js": fs.readFileSync(
    path.join(FIXTURES, "organizations.js"),
    "utf8"
  ),
  "eurth-map/public/nations.geojson": fs.readFileSync(
    path.join(FIXTURES, "nations.geojson"),
    "utf8"
  ),
};
const fetchFile = jest.fn(async ({ path: file }: { path: string }) => {
  const text = fixtureFiles[file];
  if (!text) throw new Error(`no fixture ${file}`);
  return text;
});

const preset = sourcePreset("eurth-map")!;
const configRow = {
  realmId: "eurth-id",
  enabled: true,
  provider: "github",
  repo: preset.repo,
  ref: preset.ref,
  format: preset.format,
  settings: preset.settings,
  intervalHours: 24,
  options: preset.options,
  continentMap: preset.continentMap,
  overrides: {},
  presetId: "eurth-map",
  lastRunAt: null,
  lastStatus: null,
};

function syncDb(over: Record<string, unknown> = {}) {
  const db: any = {
    realm: {
      findUnique: jest.fn().mockResolvedValue({
        id: "eurth-id",
        slug: "eurth",
        name: "Eurth",
        ownerId: "clerk_founder",
        status: "active",
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    realmSourceSync: {
      findUnique: jest.fn().mockResolvedValue(configRow),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
    },
    realmSyncRun: {
      create: jest.fn().mockResolvedValue({ id: "run1" }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    country: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    realmPage: {
      findMany: jest.fn().mockResolvedValue([
        { title: "Tavok", kind: "nation", wikiSource: "iiwiki" },
        { title: "Rostervania", kind: "nation", wikiSource: "iiwiki" },
        { title: "Kíziáuke", kind: "lore", wikiSource: "iiwiki" },
        { title: "Deseti", kind: "lore", wikiSource: "althistory" },
      ]),
    },
    mapLayer: { findMany: jest.fn().mockResolvedValue([]) },
    alliance: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  };
  return db;
}

type Viewer = {
  id: string;
  clerkUserId: string;
  role?: { name: string; level: number } | null;
} | null;
const player: Viewer = { id: "u_player", clerkUserId: "clerk_player", role: null };
const founder: Viewer = { id: "u_founder", clerkUserId: "clerk_founder", role: null };
const admin: Viewer = {
  id: "u_admin",
  clerkUserId: "clerk_admin",
  role: { name: "admin", level: 10 },
};

function caller(db: any, viewer: Viewer) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer.clerkUserId } : null,
    user: viewer ? { ...viewer, lastSeenAt: new Date() } : null,
  });
  return realmsRouter.createCaller(ctx as never).sourceSync;
}

describe("realms.sourceSync permissions: site admins and the realm's founder only", () => {
  it("refuses a player who is neither founder nor site admin, for reads and every write", async () => {
    const db = syncDb();
    const sync = caller(db, player);
    await expect(sync.get({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sync.dryRun({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sync.startApply({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sync.loadPreset({ slug: "eurth", presetId: "eurth-map" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      sync.setOverride({ kind: "nation", slug: "eurth", key: "Tavok", override: { exclude: true } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realmSyncRun.create).not.toHaveBeenCalled();
    expect(db.realmSourceSync.upsert).not.toHaveBeenCalled();
    expect(db.realmSourceSync.update).not.toHaveBeenCalled();
  });
  it("refuses settings the adapter does not accept, naming the field", async () => {
    const db = syncDb();
    await expect(
      caller(db, founder).save({
        slug: "eurth",
        config: {
          enabled: false,
          provider: "github",
          repo: "owner/repo",
          ref: "main",
          format: "eurth-map",
          settings: {
            files: { nations: "../escape.js" },
            bindings: { nations: "nations" },
            nationFields: {},
          },
          intervalHours: null,
          options: preset.options!,
          continentMap: {},
          overrides: { nations: {}, organizations: {} },
        },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("files.nations"),
    });
    expect(db.realmSourceSync.upsert).not.toHaveBeenCalled();
  });
  it("refuses source sync changes and runs on an archived realm, but still shows its settings", async () => {
    const db = syncDb();
    db.realm.findUnique.mockResolvedValue({
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      ownerId: "clerk_founder",
      status: "archived",
    });
    await expect(caller(db, admin).dryRun({ slug: "eurth" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("archived"),
    });
    await expect(
      caller(db, founder).loadPreset({ slug: "eurth", presetId: "eurth-map" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller(db, admin).get({ slug: "eurth" })).resolves.toMatchObject({
      realm: { slug: "eurth" },
    });
    expect(db.realmSyncRun.create).not.toHaveBeenCalled();
    expect(db.realmSourceSync.upsert).not.toHaveBeenCalled();
  });
  it("refuses a manual match to a nation of another realm", async () => {
    const db = syncDb();
    db.country.findUnique.mockResolvedValue({ realmId: "default" });
    await expect(
      caller(db, founder).setOverride({
        kind: "nation",
        slug: "eurth",
        key: "Tavok",
        override: { countryId: "c-ix" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("runSourceSync", () => {
  beforeEach(() => {
    mockLock.held = false;
    jest.clearAllMocks();
  });

  it("a dry run reads the source, stores the diff on the run and writes nothing else", async () => {
    const db = syncDb();
    const outcome = await runSourceSync(
      db,
      { realmId: "eurth-id", dryRun: true, triggeredBy: "clerk_admin" },
      { fetchFile }
    );
    expect(outcome.status).toBe("success");
    expect(withJobLock).toHaveBeenCalledWith(
      db,
      sourceSyncLockName("eurth-id"),
      expect.any(Function),
      expect.anything()
    );
    expect(outcome.summary!.creates.map((c) => c.name).sort()).toEqual(
      ["Bainbridge Islands", "Deseti", "Kíziáuke", "Mito", "Rostervania", "Tavok"].sort()
    );
    // Only links to the realm's own pages on its wiki stay. Mito, an NPC on the map, is created like any other.
    const wikiTitles = Object.fromEntries(
      outcome.summary!.creates.map((c) => [c.name, c.wikiTitle])
    );
    expect(wikiTitles).toEqual({
      "Bainbridge Islands": null,
      Deseti: null,
      Kíziáuke: "Kíziáuke",
      Mito: null,
      Rostervania: "Rostervania",
      Tavok: "Tavok",
    });
    expect(outcome.summary!.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Deseti: its wiki link "Deseti" is not one of the realm\'s pages'),
      ])
    );
    expect(outcome.summary!.unmatched).toEqual([]);
    expect(outcome.summary!.unknownMembers).toEqual([expect.objectContaining({ member: "Haitu" })]);
    expect(db.realmPage.findMany).toHaveBeenCalledWith({
      where: { realmId: "eurth-id" },
      select: { title: true, kind: true, wikiSource: true },
      take: 50_000,
    });
    expect(db.realmSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run1" },
        data: expect.objectContaining({ status: "success" }),
      })
    );
    // A dry run never moves the schedule.
    expect(db.realmSourceSync.update).not.toHaveBeenCalled();
  });

  it("never overlaps a run already holding the realm's lease", async () => {
    mockLock.held = true;
    const db = syncDb();
    const outcome = await runSourceSync(
      db,
      { realmId: "eurth-id", dryRun: false, triggeredBy: "cron" },
      { fetchFile }
    );
    expect(outcome).toMatchObject({
      status: "failed",
      errors: [expect.stringContaining("in progress")],
    });
    expect(fetchFile).not.toHaveBeenCalled();
  });
});

describe("runDueSourceSyncs (the realm-source-sync job)", () => {
  beforeEach(() => {
    mockLock.held = false;
  });
  it("runs only the realms whose own schedule is due, one at a time, as cron", async () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const db = syncDb();
    db.realmSourceSync.findMany.mockResolvedValue([
      {
        realmId: "due",
        enabled: true,
        intervalHours: 6,
        lastRunAt: new Date("2026-10-07T05:00:00Z"),
      },
      {
        realmId: "fresh",
        enabled: true,
        intervalHours: 24,
        lastRunAt: new Date("2026-10-07T10:00:00Z"),
      },
      { realmId: "never", enabled: true, intervalHours: 168, lastRunAt: null },
    ]);
    const order: string[] = [];
    db.realmSyncRun.create.mockImplementation(async ({ data }: any) => {
      order.push(`${data.realmId}:${data.triggeredBy}:${data.dryRun}`);
      return { id: `run-${data.realmId}` };
    });
    const result = await runDueSourceSyncs(
      db,
      { fetchFile: jest.fn().mockRejectedValue(new Error("offline")) },
      now
    );
    expect(order).toEqual(["never:cron:false", "due:cron:false"]);
    expect(result).toMatchObject({ checked: 3, ran: 2 });
    expect(db.realmSourceSync.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enabled: true, intervalHours: { not: null } } })
    );
  });
});

describe("applying a sync plan", () => {
  const ctx = {
    realmId: "eurth-id",
    realmSlug: "eurth",
    wikiSource: "iiwiki",
    attribution: "Map: test",
    areaScale: 1,
  };
  function emptyPlan(over: Partial<SyncPlan> = {}): SyncPlan {
    return {
      creates: [],
      updates: [],
      skippedClaimed: [],
      locked: [],
      features: [],
      featuresUnchanged: 0,
      alliances: [],
      unknownMembers: [],
      missing: [],
      unmatched: [],
      excluded: [],
      warnings: [],
      counts: {
        sourceNations: 0,
        matched: 0,
        create: 0,
        update: 0,
        features: 0,
        alliances: 0,
        unmatched: 0,
        missing: 0,
      },
      refills: [],
      ...over,
    };
  }
  function applyDb() {
    const db: any = {
      $transaction: jest.fn((cb: any) => cb(db)),
      country: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: any) => ({ id: `id-${data.name}` })),
        update: jest.fn().mockResolvedValue({}),
      },
      nationalIdentity: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      alliance: {
        create: jest.fn(async ({ data }: any) => ({ id: "al-new", realmId: data.realmId })),
        update: jest.fn(async () => ({ id: "al-old", realmId: "eurth-id" })),
      },
      allianceMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    return db;
  }
  describe("applySyncPlan", () => {
    beforeEach(() => jest.clearAllMocks());
    it("leaves a nation claimed since the plan alone when re-reading infoboxes, and reads nothing without a reader", async () => {
      const db = applyDb();
      db.country.findFirst = jest.fn().mockResolvedValue(null);
      const fetchInfobox = jest.fn().mockResolvedValue({ country: { flag: "f" }, identity: {} });
      const plan = emptyPlan({ refills: [{ countryId: "r1", name: "Taken", wikiTitle: "Taken" }] });
      const result = await applySyncPlan(db, ctx, plan, { fetchInfobox });
      expect(db.country.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "r1", realmId: "eurth-id", ownerUserId: null } })
      );
      expect(db.country.update).not.toHaveBeenCalled();
      expect(result.refilled).toEqual([]);
      const without = await applySyncPlan(applyDb(), ctx, plan, {});
      expect(without.refilled).toEqual([]);
    });
    it("leaves a nation claimed since the plan was made with its own figures", async () => {
      const db = applyDb();
      db.country.findUnique.mockResolvedValue({
        name: "Free",
        ownerUserId: "u-new-owner",
        baselinePopulation: 1,
        baselineGdpPerCapita: 1,
        landArea: 1,
        continent: null,
      });
      const result = await applySyncPlan(
        db,
        ctx,
        emptyPlan({
          updates: [
            {
              countryId: "f",
              name: "Free",
              key: "Free",
              claimed: false,
              bindKey: false,
              changes: [{ field: "population", from: 1, to: 5 }],
            },
          ],
        })
      );
      expect(db.country.update).not.toHaveBeenCalled();
      expect(result.updated).toBe(0);
    });
    it("creates realm alliances, adds members once, and never pulls back a nation that left", async () => {
      const db = applyDb();
      db.allianceMember.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "m", isActive: false, status: "left" });
      db.country.findUnique.mockResolvedValue({ realmId: "eurth-id" });
      const result = await applySyncPlan(
        db,
        ctx,
        emptyPlan({
          alliances: [
            {
              key: "pact",
              allianceId: null,
              name: "Some Pact",
              shortName: "SP",
              color: "#ff0000",
              type: "military",
              changes: [],
              addMembers: [
                { nation: { countryId: "a" }, name: "A" },
                { nation: { countryId: "b" }, name: "B" },
              ],
              notInSource: [],
            },
          ],
        })
      );
      expect(db.alliance.create.mock.calls[0][0].data).toMatchObject({
        realmId: "eurth-id",
        externalSourceKey: "pact",
        name: "Some Pact",
        shortName: "SP",
        type: "military",
        color: "#ff0000",
      });
      expect(db.allianceMember.create).toHaveBeenCalledTimes(1);
      expect(db.allianceMember.create.mock.calls[0][0].data).toMatchObject({
        countryId: "a",
        status: "active",
        isActive: true,
      });
      expect(result).toMatchObject({ alliancesCreated: 1, membersAdded: 1 });
    });
  });
});

/**
 * The source sync's plan reads past the guarded client's 1000-row cap: Eurth has 2,750 realm pages, and a plan
 * built from the first 1000 would create nations for pages it never saw or miss the ones it did.
 * The fake answers at most 1000 rows to a findMany with no `take`, as src/server/db.ts does.
 */
describe("planning reads every row", () => {
  const GUARD_CAP = 1000;
  /** A table whose findMany answers at most GUARD_CAP rows when no take is given. */
  function cappedTable(rows: Array<Record<string, unknown>>) {
    return {
      findMany: jest.fn(async ({ take }: { take?: number } = {}) =>
        rows.slice(0, take ?? GUARD_CAP)
      ),
    };
  }
  const config: SourceSyncConfig = {
    realmId: "eurth-id",
    enabled: true,
    provider: "github",
    repo: "x/y",
    ref: "main",
    format: "eurth-map",
    settings: {},
    intervalHours: 24,
    options: DEFAULT_SYNC_OPTIONS,
    continentMap: {},
    overrides: { nations: {}, organizations: {} },
  };
  describe("buildSyncPlan reads every row", () => {
    it("plans a nation for each of 1,500 realm pages, not the first 1000", async () => {
      const pages = Array.from({ length: 1500 }, (_, i) => ({
        title: `Page${String.fromCharCode(97 + (i % 26))}${i}x${i * 7}`,
        kind: "nation",
        wikiSource: "iiwiki",
      }));
      const db = {
        country: cappedTable([]),
        realmPage: cappedTable(pages),
        mapLayer: cappedTable([]),
        alliance: cappedTable([]),
      };
      const { plan } = await buildSyncPlan(db as never, config, {
        nations: [],
        organizations: [],
        features: [],
        warnings: [],
      });
      expect(plan.creates).toHaveLength(1500);
    });
  });
});
