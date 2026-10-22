/** @jest-environment node */
/**
 * Scenario: an admin publishes a world preset, the founder of a realm generates a world from it, checks it, applies
 * it and rolls it back. Real modules throughout: the preset store and both routers, the World tab's controls and
 * bundle, the generator through its worker runner, the upload route, the job runner, the world import, the map
 * version bump and the live-sync bus. Only the database (map-import-fakes), Clerk and the relief tile build are faked.
 *
 * The world is Eurth's preset at seed 4 on 8,000 cells, some of whose rivers cross the antimeridian: the generator cuts
 * them at ±180 (until 2026-10-21 it drew them the long way, to about 204 degrees), so the writer takes them as made.
 * The apply replaces the realm's slots as a regeneration does: the one nobody held goes, held ones stay, and each new
 * nation has its own name and slug and its border.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
const holder: { db: unknown } = { db: null };
jest.mock("~/server/db", () => ({
  db: new Proxy({}, { get: (_t, name: string) => (holder.db as Record<string, unknown>)[name] }),
}));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
}));
const clerkUser = { id: "founder_1" as string | null };
jest.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerkUser.id }) }));
jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: async () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("next/server") as typeof import("next/server")).NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    ),
}));
jest.mock("~/server/modules/maps/map-import.prune", () => ({
  pruneWorldUploadsIfDue: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true }), isEnabled: () => false },
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Feature, LineString, MultiLineString, Position } from "geojson";
import type { NextRequest } from "next/server";
import { POST as upload } from "~/app/api/admin/map-import/upload/route";
import { encodeWorldBundle, worldPresetParamsSchema } from "~/lib/maps/import/world-bundle";
import { mapUpdateBus, type MapUpdateEvent } from "~/lib/maps/map-update-bus";
import { geometryProblem } from "~/lib/maps/realm-map-writer";
import { paramsForPreset } from "~/lib/worldgen/studio-fields";
import { presetParamsOf } from "~/lib/worldgen/studio-preset-params";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { buildWorldBundle } from "~/lib/worldgen/world-apply";
import { controlsForPreset, paramsFromControls } from "~/lib/worldgen/world-controls";
import { FACTORY_PRESETS, resolvePreset } from "~/lib/worldgen/world-presets";
import { createCallerFactory } from "~/server/api/trpc";
import { atlasPresetsRouter } from "~/server/api/routers/atlas/presets";
import { geoEditorMapImportRouter } from "~/server/api/routers/geo/editor/map-import";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { runMapImportJob } from "~/server/modules/maps/map-import.jobs";
import type { ReliefRunner, WorldDryRunSummary } from "~/server/modules/maps/world-import";
import { realWorld } from "~/tests/helpers/real-world-result";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, founder, stranger } from "~/tests/server/maps/map-import-fakes";
import { RELIEF_ENTRY, seedRealm } from "~/tests/server/maps/world-import-fixtures";
import { createPresetDb } from "~/tests/server/maps/world-preset-fakes";

jest.setTimeout(60_000);

type Actor = typeof admin;
type Db = ReturnType<typeof seedRealm>;

/** One database for the realm, its map, its jobs and the preset tables, as the routers see it. */
function scenarioDb(): Db {
  const db = seedRealm({ officers: [] });
  const presets = createPresetDb().db;
  Object.assign(db, {
    worldPreset: presets.worldPreset,
    worldPresetVersion: presets.worldPresetVersion,
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  });
  return db;
}

const ctxAs = (db: Db, actor: Actor) =>
  createMockRouterContext({
    db,
    auth: { userId: actor.clerkUserId },
    user: { ...actor, country: null },
    rateLimitIdentifier: `${actor.clerkUserId}_${Math.random()}`,
  }) as never;
const presetsAs = (db: Db, actor: Actor) =>
  createCallerFactory(atlasPresetsRouter)(ctxAs(db, actor));
const realmMapAs = (db: Db, actor: Actor) => createCallerFactory(realmMapRouter)(ctxAs(db, actor));
const importAs = (db: Db, actor: Actor) =>
  createCallerFactory(geoEditorMapImportRouter)(ctxAs(db, actor)).mapImport;

/** The World tab's upload: the gzip bundle as the `file` field, for `?realm=r1`. */
async function uploadAs(clerkId: string, bytes: Uint8Array) {
  clerkUser.id = clerkId;
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], "world.json.gz"));
  const req = {
    headers: new Headers({ "content-length": String(bytes.byteLength + 500) }),
    formData: async () => form,
    nextUrl: new URL("https://ixstats.test/api/admin/map-import/upload?realm=r1"),
  } as unknown as NextRequest;
  return upload(req);
}

const lines = (feature: Feature): Position[][] =>
  feature.geometry.type === "LineString"
    ? [(feature.geometry as LineString).coordinates]
    : (feature.geometry as MultiLineString).coordinates;
const lengthOf = (line: Position[]) =>
  line
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p[0]! - line[i]![0]!, p[1]! - line[i]![1]!), 0);

type Row = Record<string, unknown>;
/** A JSON column a restore cleared is Prisma's DbNull, which serialises as {} */
const json = (value: unknown) =>
  value && typeof value === "object" && Object.keys(value).length === 0 ? null : value;
/** What a rollback must put back exactly: the realm's nations, its active map and its generation record. */
const restorable = (db: Db) =>
  JSON.stringify({
    countries: (db.country.rows as Row[])
      .map(({ id, name, slug, worldgen, claimable, ownerUserId, landArea }) => ({
        ...{ id, name, slug, worldgen, claimable, ownerUserId, landArea },
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    layers: (db.mapLayer.rows as Row[])
      .filter((r) => r.isActive)
      .map(({ layerType, featureId, countryId, geometry }) => ({
        layerType,
        featureId,
        countryId,
        geometry,
      }))
      .sort((a, b) =>
        `${a.layerType}/${a.featureId}`.localeCompare(`${b.layerType}/${b.featureId}`)
      ),
    seed: db.realm.rows[0].seed,
    generation: json(db.realm.rows[0].generationParams),
    relief: (db.realm.rows[0].settings as { map?: { layers?: unknown } }).map?.layers ?? null,
  });

let dir: string;
const events: MapUpdateEvent[] = [];
let unsubscribe: () => void;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "scenario-world-"));
  process.env.MAP_IMPORT_DIR = dir;
  unsubscribe = mapUpdateBus.subscribe((event) => events.push(event));
  // the audit middleware logs every admin call and refusal
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
  unsubscribe();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});
// Queueing a job kicks the in-process runner on a timer; no timer fires, so the test runs each job itself
beforeEach(() => jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] }));
afterEach(() => jest.useRealTimers());

describe("a founder generates a world from a published preset, applies it and rolls it back", () => {
  it("publishes, generates, checks, applies, bumps the map and restores the realm exactly", async () => {
    const db = scenarioDb();
    holder.db = db;
    const runRelief = jest.fn<ReturnType<ReliefRunner>, Parameters<ReliefRunner>>(
      async () => RELIEF_ENTRY
    );

    // 1. The admin saves Eurth with more rivers as a draft, from the Studio rail (which holds a seed), and publishes it
    const rail = { ...paramsForPreset(WORLD_PRESETS.eurth), riverDensity: 0.9, seed: 99 };
    const recipe = presetParamsOf(rail);
    expect(Object.keys(recipe).sort()).toEqual(Object.keys(paramsForPreset({})).sort());
    expect("seed" in recipe).toBe(false);
    rail.hypsometry[0] = 77; // a later edit on the rail never reaches what was saved
    expect(recipe.hypsometry?.[0]).not.toBe(77);
    expect(worldPresetParamsSchema.safeParse(recipe).success).toBe(true);
    // the server's preset schema: any parameter but the seed, inside its bounds, and nothing it does not know
    for (const refused of [
      { ...recipe, seed: 99 },
      { nonsense: 1 },
      { cellCount: 999_999 },
      { hypsometry: [1, 2] },
    ]) {
      expect(worldPresetParamsSchema.safeParse(refused).success).toBe(false);
    }
    for (const factory of FACTORY_PRESETS) {
      expect(worldPresetParamsSchema.safeParse(factory.params).success).toBe(true);
    }
    await expect(
      presetsAs(db, admin).saveDraft({ slug: "eurth", params: { ...recipe, seed: 1 } as never })
    ).rejects.toThrow();
    await expect(
      presetsAs(db, founder).saveDraft({ slug: "eurth", params: recipe })
    ).rejects.toThrow();

    await presetsAs(db, admin).saveDraft({ slug: "eurth", params: recipe });
    const draftOnly = await realmMapAs(db, founder).worldPresets({ realm: "eurth" });
    expect(draftOnly.find((p) => p.slug === "eurth")?.params.riverDensity).not.toBe(0.9);
    await presetsAs(db, admin).publish({ slug: "eurth" });

    // 2. The founder's World tab lists the published presets, in code order; strangers get none
    await expect(realmMapAs(db, stranger).worldPresets({ realm: "eurth" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const published = await realmMapAs(db, founder).worldPresets({ realm: "eurth" });
    expect(published.map((p) => p.slug)).toEqual(Object.keys(WORLD_PRESETS));
    expect(published.every((p) => p.name !== "")).toBe(true);
    expect(published.find((p) => p.slug === "eurth")?.params.riverDensity).toBe(0.9);
    // a recipe naming a preset that has since gone comes back as Earth-like, the factory one if even that is gone
    expect(resolvePreset(published, "deleted-preset").slug).toBe("earthlike");
    expect(resolvePreset([], "eurth")).toMatchObject({ slug: "earthlike", name: "Earth-like" });

    // 3. It generates from the preset's controls, through the worker runner, as the browser does
    const params = paramsFromControls(controlsForPreset("eurth", published), published);
    expect(params.riverDensity).toBe(0.9);
    const draft = realWorld({ params: { ...params, cellCount: 8000, plateCount: 8 }, seed: 4 });
    const bundle = buildWorldBundle(draft, "preset");
    // a river that crosses the antimeridian comes cut at ±180, and every layer is in range for the writer as made
    expect(bundle.layers.rivers.features.some((f) => f.geometry.type === "MultiLineString")).toBe(
      true
    );
    for (const layer of [
      "rivers",
      "political",
      "background",
      "altitudes",
      "climate",
      "lakes",
      "icecaps",
    ] as const) {
      expect(
        bundle.layers[layer]!.features.every((f) => geometryProblem(f.geometry, "any") === null)
      ).toBe(true);
    }

    // 4. The upload route takes the gzip bundle from the founder as a world, and refuses a stranger
    const bytes = await encodeWorldBundle(bundle);
    expect((await uploadAs(stranger.clerkUserId, bytes)).status).toBe(403);
    const uploaded = await uploadAs(founder.clerkUserId, bytes);
    expect(uploaded.status).toBe(200);
    const { uploadId, kind } = (await uploaded.json()) as { uploadId: string; kind: string };
    expect(kind).toBe("world");

    // 5. The check: queued by the founder (a stranger is refused), it records the map version and writes nothing
    const start = { realmId: "r1", uploadId, kind: "world" as const, filename: "world.json.gz" };
    await expect(importAs(db, stranger).start(start)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const before = restorable(db);
    const { jobId: checkId } = await importAs(db, founder).start(start);
    await runMapImportJob(db, checkId, { world: { runRelief } });
    const check = await importAs(db, founder).job({ jobId: checkId });
    expect(check).toMatchObject({ status: "succeeded", dryRun: true });
    const diff = check.result as WorldDryRunSummary;
    expect(diff.mapVersion).toBe(0);
    expect(diff.slots.create).toBe(draft.slots.length);
    expect(diff.layers.rivers.create).toBe(bundle.layers.rivers.features.length);
    expect(restorable(db)).toBe(before);

    // 6. The apply: every feature written inside ±180, every river whole, the nations made, the relief built
    await expect(importAs(db, stranger).applyWorld({ jobId: checkId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    events.length = 0;
    const { jobId: applyId } = await importAs(db, founder).applyWorld({ jobId: checkId });
    await runMapImportJob(db, applyId, { world: { runRelief } });
    const applied = await importAs(db, founder).job({ jobId: applyId });
    expect(applied).toMatchObject({ status: "succeeded", error: null });
    expect(applied.result).toMatchObject({
      phase: "world-apply",
      rejected: [],
      slots: { created: draft.slots.length },
      relief: { status: "built" },
    });
    const rivers = db.mapLayer.rows.filter(
      (r: { layerType: string; isActive: boolean }) => r.layerType === "rivers" && r.isActive
    );
    expect(rivers).toHaveLength(bundle.layers.rivers.features.length);
    for (const row of db.mapLayer.rows.filter((r: { isActive: boolean }) => r.isActive)) {
      expect(
        geometryProblem(row.geometry, row.layerType === "political" ? "polygonal" : "any")
      ).toBeNull();
    }
    // each river stored as made, its parts either side of the seam: no length lost, none added across the map
    bundle.layers.rivers.features.forEach((raw) => {
      const key = String(raw.properties?.featureId ?? raw.id);
      const stored = rivers.find((r: { featureId: string }) => r.featureId === key);
      expect(stored).toBeDefined();
      const after = lines({ type: "Feature", properties: {}, geometry: stored.geometry }).reduce(
        (sum, line) => sum + lengthOf(line),
        0
      );
      expect(after).toBeCloseTo(
        lines(raw).reduce((sum, line) => sum + lengthOf(line), 0),
        6
      );
    });
    expect(
      rivers.some((r: { geometry: { type: string } }) => r.geometry.type === "MultiLineString")
    ).toBe(true);
    expect(runRelief).toHaveBeenCalledTimes(1);
    // the slot nobody held is retired, a player's nation and a hand-made one stay; each new nation is a generated
    // slot with a name and slug of its own, linked to its border; the realm records the generation
    const seeded = ["c_old1", "c_old2", "c_owned", "c_manual"];
    const made = (db.country.rows as Row[]).filter((c) => !seeded.includes(String(c.id)));
    expect(made).toHaveLength(draft.slots.length);
    expect(db.country.rows.map((c: Row) => c.id)).toEqual(
      expect.arrayContaining(["c_old2", "c_owned", "c_manual"])
    );
    expect(db.country.rows.some((c: Row) => c.id === "c_old1")).toBe(false);
    expect(made.every((c) => c.worldgen === true && c.realmId === "r1")).toBe(true);
    const names = (db.country.rows as Row[]).map((c) => String(c.name).toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(made.map((c) => c.slug)).size).toBe(made.length);
    const linked = (c: Row) =>
      (db.mapLayer.rows as Row[]).some(
        (r) =>
          r.layerType === "political" &&
          r.isActive &&
          r.countryId === c.id &&
          r.displayName === c.name
      );
    expect(made.filter((c) => !linked(c))).toEqual([]);
    expect(db.realm.rows[0]).toMatchObject({ seed: 4, generationParams: { source: "preset" } });
    // the map version moved (the map, then its relief entry), and live sync heard it for this realm only
    const appliedVersion = db.realm.rows[0].mapVersion as number;
    expect(appliedVersion).toBeGreaterThan(diff.mapVersion!);
    const announced = events.filter((e) => e.changeType === "version");
    expect(announced.length).toBeGreaterThan(0);
    expect(announced.every((e) => e.realmId === "r1")).toBe(true);

    // 7. The rollback puts the realm back as it was before the apply, and moves the version again
    const [record] = db.mapImport.rows;
    await expect(importAs(db, stranger).rollback({ importId: record.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await importAs(db, founder).rollback({ importId: record.id });
    expect(restorable(db)).toBe(before);
    expect(db.realm.rows[0].mapVersion).toBeGreaterThan(appliedVersion);
    await expect(importAs(db, founder).rollback({ importId: record.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
