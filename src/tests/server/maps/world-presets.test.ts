/** @jest-environment node */
/**
 * World presets in the database: lazy idempotent seeding from `WORLD_PRESETS`, drafts, publishing, versions,
 * restore, reset to factory, archiving, and what founders get (published and unarchived only, never a draft).
 */
import { worldPresetParamsSchema } from "~/lib/maps/import/world-bundle";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { FACTORY_PRESETS } from "~/lib/worldgen/world-presets";
import {
  createWorldPreset,
  listPublishedWorldPresets,
  listWorldPresets,
  listWorldPresetVersions,
  publishWorldPreset,
  renameWorldPreset,
  reorderWorldPresets,
  resetWorldPresetToFactory,
  restoreWorldPresetVersion,
  saveWorldPresetDraft,
  seedWorldPresets,
  setWorldPresetArchived,
  WorldPresetError,
} from "~/server/modules/maps/world-presets";
import { createPresetDb } from "./world-preset-fakes";

const ADMIN = "admin_1";
const slugs = (list: { slug: string }[]) => list.map((p) => p.slug);

function setup() {
  const fake = createPresetDb();
  return { ...fake, client: fake.asClient() };
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "WorldPresetError", code });
}

describe("seeding", () => {
  it("creates earthlike, ixnay and eurth on first read, built-in and published, with the factory recipes", async () => {
    const { client } = setup();
    const list = await listWorldPresets(client);
    expect(slugs(list)).toEqual(["earthlike", "ixnay", "eurth"]);
    for (const preset of list) {
      expect(preset.builtIn).toBe(true);
      expect(preset.archived).toBe(false);
      expect(preset.draft).toBeNull();
      expect(preset.published?.params).toEqual(
        WORLD_PRESETS[preset.slug as keyof typeof WORLD_PRESETS]
      );
    }
    expect(list.map((p) => p.sortOrder)).toEqual([0, 1, 2]);
  });

  it("holds the factory recipes to the same bounded schema a saved preset must pass", () => {
    for (const { slug, params } of FACTORY_PRESETS) {
      expect({ slug, ok: worldPresetParamsSchema.safeParse(params).success }).toEqual({
        slug,
        ok: true,
      });
    }
  });

  it("is idempotent: reading again, or concurrently, adds no rows", async () => {
    const { client, presets, versions } = setup();
    await Promise.all([listWorldPresets(client), listPublishedWorldPresets(client)]);
    await listWorldPresets(client);
    await seedWorldPresets(client);
    expect(presets).toHaveLength(3);
    expect(versions).toHaveLength(3);
  });

  it("does not touch a built-in the admin has since published or edited", async () => {
    const { client, presets, versions } = setup();
    await listWorldPresets(client);
    await saveWorldPresetDraft(client, ADMIN, "ixnay", { oceanPercentage: 0.5 });
    await publishWorldPreset(client, "ixnay");
    await seedWorldPresets(client);
    expect(presets).toHaveLength(3);
    expect(versions).toHaveLength(4);
    const ixnay = (await listWorldPresets(client)).find((p) => p.slug === "ixnay");
    expect(ixnay?.published?.params).toEqual({ oceanPercentage: 0.5 });
  });

  it("finishes a seed that stopped half way (presets without their published version)", async () => {
    const { client, presets } = setup();
    await listWorldPresets(client);
    presets.forEach((row) => (row.publishedVersionId = null));
    const list = await listWorldPresets(client);
    expect(list.every((p) => p.published !== null)).toBe(true);
  });
});

describe("create, rename, reorder, archive", () => {
  it("creates an unpublished draft preset, last in order, with a slug from its name", async () => {
    const { client } = setup();
    const created = await createWorldPreset(client, ADMIN, {
      name: "Dry Archipelago",
      params: { oceanPercentage: 0.9 },
    });
    expect(created).toMatchObject({
      slug: "dry-archipelago",
      name: "Dry Archipelago",
      builtIn: false,
      sortOrder: 3,
      published: null,
      archived: false,
    });
    expect(created.draft?.params).toEqual({ oceanPercentage: 0.9 });
  });

  it("gives a second preset of the same name its own slug, and never takes a built-in's", async () => {
    const { client } = setup();
    const first = await createWorldPreset(client, ADMIN, { name: "Eurth" });
    const second = await createWorldPreset(client, ADMIN, { name: "Eurth" });
    expect([first.slug, second.slug]).toEqual(["eurth-2", "eurth-3"]);
  });

  it("refuses a recipe carrying a seed, or a value out of range, without writing anything", async () => {
    const { client, presets } = setup();
    const withSeed = { oceanPercentage: 0.5, ...{ seed: 7 } };
    await rejectsWith(
      createWorldPreset(client, ADMIN, { name: "Seeded", params: withSeed }),
      "BAD_REQUEST"
    );
    await rejectsWith(
      createWorldPreset(client, ADMIN, { name: "Wet", params: { oceanPercentage: 2 } }),
      "BAD_REQUEST"
    );
    expect(presets).toHaveLength(3);
  });

  it("renames without changing the slug, and keeps the description unless given one", async () => {
    const { client } = setup();
    const created = await createWorldPreset(client, ADMIN, { name: "Old", description: "Kept" });
    const renamed = await renameWorldPreset(client, created.slug, "New");
    expect(renamed).toMatchObject({ slug: "old", name: "New", description: "Kept" });
    expect(await renameWorldPreset(client, "old", "Newer", "Changed")).toMatchObject({
      slug: "old",
      description: "Changed",
    });
    await rejectsWith(renameWorldPreset(client, "nope", "X"), "NOT_FOUND");
  });

  it("reorders, leaving the presets it is not told about after the ones it is", async () => {
    const { client } = setup();
    await createWorldPreset(client, ADMIN, { name: "Extra" });
    await setWorldPresetArchived(client, "extra", true);
    const list = await reorderWorldPresets(client, ["eurth", "earthlike"]);
    expect(slugs(list)).toEqual(["eurth", "earthlike", "ixnay", "extra"]);
    expect(list.map((p) => p.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("refuses a reorder naming an unknown preset or one twice", async () => {
    const { client } = setup();
    await rejectsWith(reorderWorldPresets(client, ["eurth", "nope"]), "NOT_FOUND");
    await rejectsWith(reorderWorldPresets(client, ["eurth", "eurth"]), "BAD_REQUEST");
  });

  it("archives a custom preset and brings it back, but never a built-in", async () => {
    const { client } = setup();
    await createWorldPreset(client, ADMIN, { name: "Extra" });
    expect((await setWorldPresetArchived(client, "extra", true)).archived).toBe(true);
    expect(slugs(await listWorldPresets(client))).not.toContain("extra");
    expect(slugs(await listWorldPresets(client, { includeArchived: true }))).toContain("extra");
    expect((await setWorldPresetArchived(client, "extra", false)).archived).toBe(false);
    for (const slug of ["earthlike", "ixnay", "eurth"]) {
      await rejectsWith(setWorldPresetArchived(client, slug, true), "CONFLICT");
    }
  });
});

describe("drafts and publishing", () => {
  it("saves the draft in place, keeping the published version as it was", async () => {
    const { client } = setup();
    const first = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 }, "first");
    const second = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 3 });
    expect(second.draft?.versionId).toBe(first.draft?.versionId);
    expect(second.draft?.params).toEqual({ riverDensity: 3 });
    expect(second.published?.params).toEqual(WORLD_PRESETS.eurth);
  });

  it("refuses a seed or a value out of range in a draft", async () => {
    const { client } = setup();
    const withSeed = { riverDensity: 2, ...{ seed: 1 } };
    await rejectsWith(saveWorldPresetDraft(client, ADMIN, "eurth", withSeed), "BAD_REQUEST");
    await rejectsWith(
      saveWorldPresetDraft(client, ADMIN, "eurth", { cellCount: 5 }),
      "BAD_REQUEST"
    );
    const eurth = (await listWorldPresets(client)).find((p) => p.slug === "eurth");
    expect(eurth?.draft).toBeNull();
  });

  it("publishes the draft: it becomes the published version and the preset has no draft", async () => {
    const { client } = setup();
    const saved = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    const published = await publishWorldPreset(client, "eurth", "More rivers");
    expect(published.draft).toBeNull();
    expect(published.published).toMatchObject({
      versionId: saved.draft?.versionId,
      params: { riverDensity: 2 },
    });
    expect(published.published?.publishedAt).toBeInstanceOf(Date);
  });

  it("starts a new draft after a publish and never rewrites the published version", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    const published = await publishWorldPreset(client, "eurth");
    const next = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 4 });
    expect(next.draft?.versionId).not.toBe(published.published?.versionId);
    expect(next.published).toEqual(published.published);
  });

  it("has nothing to publish without a draft", async () => {
    const { client } = setup();
    await rejectsWith(publishWorldPreset(client, "eurth"), "CONFLICT");
    await rejectsWith(publishWorldPreset(client, "nope"), "NOT_FOUND");
  });
});

describe("versions, restore, reset to factory", () => {
  it("lists the published versions newest first, the current one marked, never a draft", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "ixnay", { riverDensity: 2 }, "two");
    await publishWorldPreset(client, "ixnay");
    await saveWorldPresetDraft(client, ADMIN, "ixnay", { riverDensity: 3 });
    const versions = await listWorldPresetVersions(client, "ixnay");
    expect(versions.map((v) => [v.params.riverDensity, v.current])).toEqual([
      [2, true],
      [WORLD_PRESETS.ixnay.riverDensity, false],
    ]);
    expect(versions[1]).toMatchObject({ note: "Factory", createdBy: "system" });
  });

  it("restores a published version as a new draft, replacing the draft there was", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "ixnay", { riverDensity: 2 });
    await publishWorldPreset(client, "ixnay");
    await saveWorldPresetDraft(client, ADMIN, "ixnay", { riverDensity: 4.5 });
    const factoryVersion = (await listWorldPresetVersions(client, "ixnay"))[1]!;
    const restored = await restoreWorldPresetVersion(
      client,
      ADMIN,
      "ixnay",
      factoryVersion.versionId
    );
    expect(restored.draft?.params).toEqual(WORLD_PRESETS.ixnay);
    expect(restored.published?.params).toEqual({ riverDensity: 2 });
    const [current] = await listWorldPresetVersions(client, "ixnay");
    expect(current?.current).toBe(true);
  });

  it("restores only a published version of that preset", async () => {
    const { client } = setup();
    const draft = await saveWorldPresetDraft(client, ADMIN, "ixnay", { riverDensity: 2 });
    const eurth = (await listWorldPresetVersions(client, "eurth"))[0]!;
    await rejectsWith(
      restoreWorldPresetVersion(client, ADMIN, "ixnay", draft.draft!.versionId),
      "NOT_FOUND"
    );
    await rejectsWith(
      restoreWorldPresetVersion(client, ADMIN, "ixnay", eurth.versionId),
      "NOT_FOUND"
    );
    await rejectsWith(restoreWorldPresetVersion(client, ADMIN, "ixnay", "missing"), "NOT_FOUND");
  });

  it("resets a built-in to a new draft from WORLD_PRESETS, leaving what is published alone", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    await publishWorldPreset(client, "eurth");
    const reset = await resetWorldPresetToFactory(client, ADMIN, "eurth");
    expect(reset.draft?.params).toEqual(WORLD_PRESETS.eurth);
    expect(reset.published?.params).toEqual({ riverDensity: 2 });
  });

  it("has no factory values for a preset that is not built in", async () => {
    const { client } = setup();
    await createWorldPreset(client, ADMIN, { name: "Mine" });
    await rejectsWith(resetWorldPresetToFactory(client, ADMIN, "mine"), "BAD_REQUEST");
    await rejectsWith(resetWorldPresetToFactory(client, ADMIN, "nope"), "NOT_FOUND");
  });
});

describe("what founders get", () => {
  it("is the published, unarchived presets in order, by name and recipe", async () => {
    const { client } = setup();
    const list = await listPublishedWorldPresets(client);
    expect(list).toEqual(FACTORY_PRESETS.map(({ slug, name, params }) => ({ slug, name, params })));
  });

  it("never includes a draft: the published recipe stays until the draft is published", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    const before = (await listPublishedWorldPresets(client)).find((p) => p.slug === "eurth");
    expect(before?.params).toEqual(WORLD_PRESETS.eurth);
    await publishWorldPreset(client, "eurth");
    const after = (await listPublishedWorldPresets(client)).find((p) => p.slug === "eurth");
    expect(after?.params).toEqual({ riverDensity: 2 });
  });

  it("never includes a preset that was never published", async () => {
    const { client } = setup();
    await createWorldPreset(client, ADMIN, { name: "Wip", params: { riverDensity: 2 } });
    expect(slugs(await listPublishedWorldPresets(client))).not.toContain("wip");
  });

  it("never includes an archived preset, and has it again once it is brought back", async () => {
    const { client } = setup();
    await createWorldPreset(client, ADMIN, { name: "Extra" });
    await publishWorldPreset(client, "extra");
    expect(slugs(await listPublishedWorldPresets(client))).toContain("extra");
    await setWorldPresetArchived(client, "extra", true);
    expect(slugs(await listPublishedWorldPresets(client))).not.toContain("extra");
    await setWorldPresetArchived(client, "extra", false);
    expect(slugs(await listPublishedWorldPresets(client))).toContain("extra");
  });

  it("follows the admin's order", async () => {
    const { client } = setup();
    await reorderWorldPresets(client, ["eurth", "ixnay", "earthlike"]);
    expect(slugs(await listPublishedWorldPresets(client))).toEqual(["eurth", "ixnay", "earthlike"]);
  });

  it("drops only the stored keys that fail validation, keeps the rest, and warns naming the preset and keys", async () => {
    const { client, versions } = setup();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await listWorldPresets(client);
    versions.find((v) => v.presetId.endsWith("eurth"))!.params = {
      riverDensity: 2,
      seed: 5,
      oceanPercentage: 9,
      polarLand: { north: true, south: false },
    };
    const eurth = (await listPublishedWorldPresets(client)).find((p) => p.slug === "eurth");
    expect(eurth?.params).toEqual({ riverDensity: 2, polarLand: { north: true, south: false } });
    const message = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(message).toContain("eurth");
    expect(message).toContain("seed");
    expect(message).toContain("oceanPercentage");
    expect(message).not.toContain("riverDensity");
    warn.mockRestore();
  });

  it("reads stored params that are not an object as no overrides, with a warning", async () => {
    const { client, versions } = setup();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await listWorldPresets(client);
    versions.find((v) => v.presetId.endsWith("eurth"))!.params = [1, 2];
    const eurth = (await listPublishedWorldPresets(client)).find((p) => p.slug === "eurth");
    expect(eurth?.params).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not warn for a recipe that is valid", async () => {
    const { client } = setup();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await listPublishedWorldPresets(client);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("concurrent edits", () => {
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
    db.worldPreset.create.mockImplementationOnce(async (args) => {
      await realCreate({ data: { slug: "racy", name: "Other admin's" } });
      throw Object.assign(new Error("Unique constraint failed on slug"), { code: "P2002" });
    });
    const created = await createWorldPreset(client, ADMIN, { name: "Racy" });
    expect(created.slug).toBe("racy-2");
    expect(presets.map((p) => p.slug)).toEqual(expect.arrayContaining(["racy", "racy-2"]));
  });

  it("reports a CONFLICT when the slug is taken again on the retry", async () => {
    const { client, db } = setup();
    await listWorldPresets(client);
    db.worldPreset.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed on slug"), { code: "P2002" })
    );
    await rejectsWith(createWorldPreset(client, ADMIN, { name: "Racy" }), "CONFLICT");
  });

  it("does not hide another failure as a slug clash", async () => {
    const { client, db } = setup();
    await listWorldPresets(client);
    db.worldPreset.create.mockRejectedValue(new Error("connection lost"));
    await expect(createWorldPreset(client, ADMIN, { name: "Racy" })).rejects.toThrow(
      "connection lost"
    );
  });
});
