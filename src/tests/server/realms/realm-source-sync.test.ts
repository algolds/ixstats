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

import fs from "node:fs";
import path from "node:path";
import { realmsRouter } from "~/server/api/routers/realms";
import { CRON_JOBS } from "~/server/cron/jobs";
import { sourcePreset } from "~/lib/realms/sources/presets";
import { withJobLock } from "~/lib/system/job-lock";
import {
  runDueSourceSyncs,
  runSourceSync,
  sourceSyncLockName,
} from "~/server/modules/realms/realms.source-sync";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const FIXTURES = path.resolve(__dirname, "../../fixtures/realm-sources/eurth-map");
const fixtureFiles: Record<string, string> = {
  "eurth-map/src/data/nations.js": fs.readFileSync(path.join(FIXTURES, "nations.js"), "utf8"),
  "eurth-map/src/data/organizations.js": fs.readFileSync(path.join(FIXTURES, "organizations.js"), "utf8"),
  "eurth-map/public/nations.geojson": fs.readFileSync(path.join(FIXTURES, "nations.geojson"), "utf8"),
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
      findUnique: jest.fn().mockResolvedValue({ id: "eurth-id", slug: "eurth", name: "Eurth", ownerId: "clerk_founder" }),
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
    country: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    realmPage: { findMany: jest.fn().mockResolvedValue([{ title: "Tavok" }, { title: "Rostervania" }]) },
    mapLayer: { findMany: jest.fn().mockResolvedValue([]) },
    alliance: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  };
  return db;
}

type Viewer = { id: string; clerkUserId: string; role?: { name: string; level: number } | null } | null;
const player: Viewer = { id: "u_player", clerkUserId: "clerk_player", role: null };
const founder: Viewer = { id: "u_founder", clerkUserId: "clerk_founder", role: null };
const admin: Viewer = { id: "u_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } };

function caller(db: any, viewer: Viewer) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer.clerkUserId } : null,
    user: viewer ? { ...viewer, lastSeenAt: new Date() } : null,
  });
  return realmsRouter.createCaller(ctx as never).sourceSync;
}

describe("realms.sourceSync permissions: site admins and the realm's founder only", () => {
  it("refuses signed-out viewers", async () => {
    await expect(caller(syncDb(), null).get({ slug: "eurth" })).rejects.toThrow("Authentication required");
    await expect(caller(syncDb(), null).dryRun({ slug: "eurth" })).rejects.toThrow("Authentication required");
  });

  it("refuses a player who is neither founder nor site admin, for reads and every write", async () => {
    const db = syncDb();
    const sync = caller(db, player);
    await expect(sync.get({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sync.dryRun({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sync.startApply({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sync.loadPreset({ slug: "eurth", presetId: "eurth-map" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      sync.setOverride({ kind: "nation", slug: "eurth", key: "Tavok", override: { exclude: true } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realmSyncRun.create).not.toHaveBeenCalled();
    expect(db.realmSourceSync.upsert).not.toHaveBeenCalled();
    expect(db.realmSourceSync.update).not.toHaveBeenCalled();
  });

  it("lets the founder and a site admin read the settings", async () => {
    for (const viewer of [founder, admin]) {
      const view = await caller(syncDb(), viewer).get({ slug: "eurth" });
      expect(view.config).toMatchObject({ repo: "a-seth-harrison/eurth-map", format: "eurth-map" });
    }
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
          settings: { files: { nations: "../escape.js" }, bindings: { nations: "nations" }, nationFields: {} },
          intervalHours: null,
          options: preset.options!,
          continentMap: {},
          overrides: { nations: {}, organizations: {} },
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("files.nations") });
    expect(db.realmSourceSync.upsert).not.toHaveBeenCalled();
  });

  it("loads a preset into the realm's own row", async () => {
    const db = syncDb();
    await caller(db, admin).loadPreset({ slug: "eurth", presetId: "eurth-map" });
    const { create, update } = db.realmSourceSync.upsert.mock.calls[0][0];
    expect(create).toMatchObject({ realmId: "eurth-id", repo: preset.repo, presetId: "eurth-map", enabled: false });
    expect(Object.keys(update.continentMap)).toHaveLength(115);
  });

  it("fills the realm's wiki settings from the preset when the realm has none, and only then", async () => {
    const db = syncDb();
    db.realm.findUnique.mockResolvedValue({
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      ownerId: "clerk_founder",
      settings: { maxNationsPerUser: 2 },
    });
    const result = await caller(db, admin).loadPreset({ slug: "eurth", presetId: "eurth-map" });
    expect(result).toMatchObject({ wikiFilled: true });
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth-id" },
      data: { settings: { maxNationsPerUser: 2, wiki: preset.wiki } },
    });

    db.realm.update.mockClear();
    db.realm.findUnique.mockResolvedValue({
      id: "eurth-id",
      slug: "eurth",
      name: "Eurth",
      ownerId: "clerk_founder",
      settings: { wiki: { ...preset.wiki, keyword: "Eurthian" } },
    });
    expect(await caller(db, admin).loadPreset({ slug: "eurth", presetId: "eurth-map" })).toMatchObject({
      wikiFilled: false,
    });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("refuses a manual match to a nation of another realm", async () => {
    const db = syncDb();
    db.country.findUnique.mockResolvedValue({ realmId: "default" });
    await expect(
      caller(db, founder).setOverride({ kind: "nation", slug: "eurth", key: "Tavok", override: { countryId: "c-ix" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("serves the map's attribution line publicly", async () => {
    await expect(caller(syncDb(), null).mapAttribution({ slug: "eurth" })).resolves.toBe(
      "Map: Eurth community, via eurth-map by Seth Harrison"
    );
  });
});

describe("runSourceSync", () => {
  beforeEach(() => {
    mockLock.held = false;
    jest.clearAllMocks();
  });

  it("a dry run reads the source, stores the diff on the run and writes nothing else", async () => {
    const db = syncDb();
    const outcome = await runSourceSync(db, { realmId: "eurth-id", dryRun: true, triggeredBy: "clerk_admin" }, { fetchFile });
    expect(outcome.status).toBe("success");
    expect(withJobLock).toHaveBeenCalledWith(db, sourceSyncLockName("eurth-id"), expect.any(Function), expect.anything());
    expect(outcome.summary!.creates.map((c) => c.name).sort()).toEqual(
      ["Bainbridge Islands", "Deseti", "Kíziáuke", "Mito", "Rostervania", "Tavok"].sort()
    );
    expect(outcome.summary!.unknownMembers).toEqual([
      expect.objectContaining({ member: "Haitu" }),
    ]);
    expect(db.realmSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "run1" }, data: expect.objectContaining({ status: "success" }) })
    );
    // A dry run never moves the schedule.
    expect(db.realmSourceSync.update).not.toHaveBeenCalled();
  });

  it("never overlaps a run already holding the realm's lease", async () => {
    mockLock.held = true;
    const db = syncDb();
    const outcome = await runSourceSync(db, { realmId: "eurth-id", dryRun: false, triggeredBy: "cron" }, { fetchFile });
    expect(outcome).toMatchObject({ status: "failed", errors: [expect.stringContaining("in progress")] });
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it("records a failed read as a failed run", async () => {
    const db = syncDb();
    const outcome = await runSourceSync(
      db,
      { realmId: "eurth-id", dryRun: true, triggeredBy: "script" },
      { fetchFile: jest.fn().mockRejectedValue(new Error("HTTP 404")) }
    );
    expect(outcome).toMatchObject({ status: "failed", errors: ["HTTP 404"] });
  });
});

describe("runDueSourceSyncs (the realm-source-sync job)", () => {
  beforeEach(() => {
    mockLock.held = false;
  });

  it("is in the cron table with its own lease", () => {
    expect(CRON_JOBS.find((job) => job.name === "realm-source-sync")).toMatchObject({
      lockName: "realm-source-sync",
      exportName: "runDueSourceSyncs",
    });
  });

  it("runs only the realms whose own schedule is due, one at a time, as cron", async () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const db = syncDb();
    db.realmSourceSync.findMany.mockResolvedValue([
      { realmId: "due", enabled: true, intervalHours: 6, lastRunAt: new Date("2026-10-07T05:00:00Z") },
      { realmId: "fresh", enabled: true, intervalHours: 24, lastRunAt: new Date("2026-10-07T10:00:00Z") },
      { realmId: "never", enabled: true, intervalHours: 168, lastRunAt: null },
    ]);
    const order: string[] = [];
    db.realmSyncRun.create.mockImplementation(async ({ data }: any) => {
      order.push(`${data.realmId}:${data.triggeredBy}:${data.dryRun}`);
      return { id: `run-${data.realmId}` };
    });
    const result = await runDueSourceSyncs(db, { fetchFile: jest.fn().mockRejectedValue(new Error("offline")) }, now);
    expect(order).toEqual(["never:cron:false", "due:cron:false"]);
    expect(result).toMatchObject({ checked: 3, ran: 2 });
    expect(db.realmSourceSync.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enabled: true, intervalHours: { not: null } } })
    );
  });
});
