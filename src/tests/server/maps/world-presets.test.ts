/** @jest-environment node */
/**
 * World presets in the database and who reaches them: seeding from `WORLD_PRESETS` is idempotent and never undoes an
 * admin's edit, a published version is never rewritten (not by a later draft, not by a save racing a publish), a
 * create that lost the race for a slug takes the next one; atlas.presets writes are for site admins only and refuse a
 * recipe with a seed, and realms.map.worldPresets gives the realm's founder and its Map officers the published presets
 * only (never a draft, an unpublished or an archived one), and nobody else.
 *
 * Folds: src/tests/server/api/routers/atlas-presets.test.ts
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));

import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { createCallerFactory } from "~/server/api/trpc";
import { atlasPresetsRouter } from "~/server/api/routers/atlas/presets";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import {
  createWorldPreset,
  listPublishedWorldPresets,
  listWorldPresets,
  publishWorldPreset,
  saveWorldPresetDraft,
  seedWorldPresets,
} from "~/server/modules/maps/world-presets";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createPresetDb } from "./world-preset-fakes";

const ADMIN = "admin_1";

function setup() {
  const fake = createPresetDb();
  return { ...fake, client: fake.asClient() };
}

describe("the preset store", () => {
  it("seeds idempotently: concurrent reads and a re-seed add no rows and never undo an admin's publish", async () => {
    const { client, presets, versions } = setup();
    await Promise.all([listWorldPresets(client), listPublishedWorldPresets(client)]);
    await listWorldPresets(client);
    await seedWorldPresets(client);
    expect(presets).toHaveLength(3);
    expect(versions).toHaveLength(3);

    await saveWorldPresetDraft(client, ADMIN, "ixnay", { oceanPercentage: 0.5 });
    await publishWorldPreset(client, "ixnay");
    await seedWorldPresets(client);
    expect(presets).toHaveLength(3);
    expect(versions).toHaveLength(4);
    const ixnay = (await listWorldPresets(client)).find((p) => p.slug === "ixnay");
    expect(ixnay?.published?.params).toEqual({ oceanPercentage: 0.5 });
  });

  it("starts a new draft after a publish and never rewrites the published version", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    const published = await publishWorldPreset(client, "eurth");
    const next = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 4 });
    expect(next.draft?.versionId).not.toBe(published.published?.versionId);
    expect(next.published).toEqual(published.published);
  });

  it("never rewrites a version published between the read and the save: the save starts a new draft", async () => {
    const { client, db, versions } = setup();
    const first = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    const draftId = first.draft!.versionId;
    // Another admin publishes the draft after this save has read the preset and before it writes
    const realUpdateMany = db.worldPresetVersion.updateMany.getMockImplementation()!;
    db.worldPresetVersion.updateMany.mockImplementationOnce(async (args) => {
      await publishWorldPreset(client, "eurth");
      return realUpdateMany(args);
    });
    const saved = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 3 });
    expect(versions.find((v) => v.id === draftId)?.params).toEqual({ riverDensity: 2 });
    expect(saved.published?.params).toEqual({ riverDensity: 2 });
    expect(saved.draft?.params).toEqual({ riverDensity: 3 });
    expect(saved.draft?.versionId).not.toBe(draftId);
  });

  it("retries a create that lost the race for a slug, with the next free one", async () => {
    const { client, db, presets } = setup();
    await listWorldPresets(client);
    const realCreate = db.worldPreset.create.getMockImplementation()!;
    db.worldPreset.create.mockImplementationOnce(async () => {
      await realCreate({ data: { slug: "racy", name: "Other admin's" } });
      throw Object.assign(new Error("Unique constraint failed on slug"), { code: "P2002" });
    });
    const created = await createWorldPreset(client, ADMIN, { name: "Racy" });
    expect(created.slug).toBe("racy-2");
    expect(presets.map((p) => p.slug)).toEqual(expect.arrayContaining(["racy", "racy-2"]));
  });
});

const presetsCaller = createCallerFactory(atlasPresetsRouter);
const mapCaller = createCallerFactory(realmMapRouter);
type PresetDb = ReturnType<typeof createPresetDb>["db"];

// The audit log middleware writes through `auditLog`; the preset tables are the fake's
const ctxFor = (db: PresetDb, admin: boolean, realm: object | null = null) =>
  createMockRouterContext({
    auth: { userId: admin ? "admin_1" : "user_1" },
    user: {
      id: "db1",
      clerkUserId: admin ? "admin_1" : "user_1",
      role: admin ? { name: "admin", level: 10 } : { name: "user", level: 100 },
    },
    db: Object.assign(db, {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      realm: { findUnique: jest.fn().mockResolvedValue(realm) },
    }),
  });

/** A realm row as the access checks read it: `founder` owns it, `officers` hold powers in it */
const realmRow = (founder: string, officers: { userId: string; powers: string[] }[] = []) => ({
  id: "r_eurth",
  status: "active",
  ownerId: founder,
  officers,
});

describe("atlas.presets: site admins only", () => {
  it.each([
    ["create", (c: ReturnType<typeof presetsCaller>) => c.create({ name: "X" })],
    [
      "saveDraft",
      (c: ReturnType<typeof presetsCaller>) => c.saveDraft({ slug: "eurth", params: {} }),
    ],
    ["publish", (c: ReturnType<typeof presetsCaller>) => c.publish({ slug: "eurth" })],
  ])("refuses an ordinary user calling %s, touching no table", async (_name, call) => {
    const { db } = createPresetDb();
    await expect(call(presetsCaller(ctxFor(db, false) as never))).rejects.toThrow();
    expect(db.worldPreset.count).not.toHaveBeenCalled();
    expect(db.worldPreset.create).not.toHaveBeenCalled();
    expect(db.worldPresetVersion.create).not.toHaveBeenCalled();
  });

  it("refuses a recipe with a seed, or an unknown key, before anything is written", async () => {
    const { db, presets } = createPresetDb();
    const caller = presetsCaller(ctxFor(db, true) as never);
    const withSeed = { riverDensity: 2, ...{ seed: 5 } };
    await expect(caller.saveDraft({ slug: "eurth", params: withSeed })).rejects.toThrow(
      /seed|unrecognized/i
    );
    await expect(caller.create({ name: "Seeded", params: withSeed })).rejects.toThrow();
    await expect(
      caller.saveDraft({ slug: "eurth", params: { ...{ nonsense: 1 } } })
    ).rejects.toThrow();
    expect(presets).toHaveLength(0);
  });
});

describe("realms.map.worldPresets", () => {
  /** The store with a draft of Eurth, a preset never published, and one published then archived. */
  async function storeWithUnpublished() {
    const { db } = createPresetDb();
    const admin = presetsCaller(ctxFor(db, true) as never);
    await admin.saveDraft({ slug: "eurth", params: { riverDensity: 2 } });
    await admin.create({ name: "Wip", params: { riverDensity: 2 } });
    await admin.create({ name: "Extra" });
    await admin.publish({ slug: "extra" });
    await admin.archive({ slug: "extra" });
    return db;
  }
  const signedOut = (db: PresetDb) => createMockRouterContext({ auth: null, user: null, db });

  it.each([
    ["the realm's founder", (db: PresetDb) => ctxFor(db, false, realmRow("user_1"))],
    [
      "an officer with the Map power",
      (db: PresetDb) => ctxFor(db, false, realmRow("f", [{ userId: "user_1", powers: ["map"] }])),
    ],
  ])(
    "gives %s the published presets only: no draft, no unpublished or archived preset",
    async (_who, ctx) => {
      const db = await storeWithUnpublished();
      const list = await mapCaller(ctx(db) as never).worldPresets({ realm: "eurth" });
      expect(list.map((p) => p.slug)).toEqual(["earthlike", "ixnay", "eurth"]);
      expect(list.find((p) => p.slug === "eurth")?.params).toEqual(WORLD_PRESETS.eurth);
    }
  );

  it.each([
    [
      "an officer without the Map power",
      (db: PresetDb) =>
        ctxFor(db, false, realmRow("f", [{ userId: "user_1", powers: ["claims"] }])),
      { code: "FORBIDDEN" },
    ],
    [
      "someone who is not signed in",
      signedOut,
      { message: expect.stringMatching(/Authentication required/) },
    ],
  ])("is refused to %s", async (_who, ctx, refusal) => {
    const db = await storeWithUnpublished();
    await expect(
      mapCaller(ctx(db) as never).worldPresets({ realm: "eurth" })
    ).rejects.toMatchObject(refusal);
  });
});
