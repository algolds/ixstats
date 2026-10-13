/** @jest-environment node */
/**
 * atlas.presets is for site admins only, and refuses a recipe with a seed; realms.map.worldPresets gives any signed-in
 * user the published presets and nothing else.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { atlasPresetsRouter } from "~/server/api/routers/atlas/presets";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createPresetDb } from "../../maps/world-preset-fakes";

const presetsCaller = createCallerFactory(atlasPresetsRouter);
const mapCaller = createCallerFactory(realmMapRouter);

// The audit log middleware writes through `auditLog`; the preset tables are the fake's
const ctxFor = (db: ReturnType<typeof createPresetDb>["db"], admin: boolean, realm = null) =>
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

describe("atlas.presets auth", () => {
  const calls: [string, (c: ReturnType<typeof presetsCaller>) => Promise<unknown>][] = [
    ["list", (c) => c.list()],
    ["create", (c) => c.create({ name: "X" })],
    ["rename", (c) => c.rename({ slug: "eurth", name: "X" })],
    ["reorder", (c) => c.reorder({ slugs: ["eurth"] })],
    ["archive", (c) => c.archive({ slug: "eurth" })],
    ["saveDraft", (c) => c.saveDraft({ slug: "eurth", params: {} })],
    ["publish", (c) => c.publish({ slug: "eurth" })],
    ["versions", (c) => c.versions({ slug: "eurth" })],
    ["restore", (c) => c.restore({ slug: "eurth", versionId: "v" })],
    ["resetToFactory", (c) => c.resetToFactory({ slug: "eurth" })],
  ];

  it.each(calls)("rejects an ordinary user calling %s, touching no table", async (_name, call) => {
    const { db } = createPresetDb();
    await expect(call(presetsCaller(ctxFor(db, false) as never))).rejects.toThrow();
    expect(db.worldPreset.count).not.toHaveBeenCalled();
    expect(db.worldPreset.create).not.toHaveBeenCalled();
    expect(db.worldPresetVersion.create).not.toHaveBeenCalled();
  });

  it("lets an admin list, save a draft, publish and see the version", async () => {
    const { db } = createPresetDb();
    const caller = presetsCaller(ctxFor(db, true) as never);
    expect((await caller.list()).map((p) => p.slug)).toEqual(["earthlike", "ixnay", "eurth"]);
    await caller.saveDraft({ slug: "eurth", params: { riverDensity: 2 }, note: "More rivers" });
    const published = await caller.publish({ slug: "eurth" });
    expect(published.published?.params).toEqual({ riverDensity: 2 });
    expect((await caller.versions({ slug: "eurth" }))[0]).toMatchObject({
      current: true,
      note: "More rivers",
      createdBy: "admin_1",
    });
  });

  it("rejects a recipe with a seed, or an unknown key, before anything is written", async () => {
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

  it("reports a missing preset as NOT_FOUND and a built-in's archive as CONFLICT", async () => {
    const { db } = createPresetDb();
    const caller = presetsCaller(ctxFor(db, true) as never);
    await expect(caller.publish({ slug: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.archive({ slug: "eurth" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("realms.map.worldPresets", () => {
  it("gives the realm's founder the published presets, not the draft", async () => {
    const { db } = createPresetDb();
    const admin = presetsCaller(ctxFor(db, true) as never);
    await admin.saveDraft({ slug: "eurth", params: { riverDensity: 2 } });
    const founder = ctxFor(db, false, realmRow("user_1") as never);
    const list = await mapCaller(founder as never).worldPresets({ realm: "eurth" });
    expect(list.map((p) => p.slug)).toEqual(["earthlike", "ixnay", "eurth"]);
    expect(list.find((p) => p.slug === "eurth")?.params).not.toEqual({ riverDensity: 2 });
  });

  it("is refused to a member without map access to the realm", async () => {
    const { db } = createPresetDb();
    const member = ctxFor(db, false, realmRow("someone_else") as never);
    await expect(mapCaller(member as never).worldPresets({ realm: "eurth" })).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
  });

  it("is refused to an officer without the Map power, and given to one with it", async () => {
    const { db } = createPresetDb();
    const without = ctxFor(db, false, realmRow("f", [{ userId: "user_1", powers: ["claims"] }]));
    await expect(
      mapCaller(without as never).worldPresets({ realm: "eurth" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const withMap = ctxFor(db, false, realmRow("f", [{ userId: "user_1", powers: ["map"] }]));
    await expect(
      mapCaller(withMap as never).worldPresets({ realm: "eurth" })
    ).resolves.toHaveLength(3);
  });

  it("is refused to someone who is not signed in", async () => {
    const { db } = createPresetDb();
    const ctx = createMockRouterContext({ auth: null, user: null, db });
    await expect(mapCaller(ctx as never).worldPresets({ realm: "eurth" })).rejects.toThrow();
  });
});
