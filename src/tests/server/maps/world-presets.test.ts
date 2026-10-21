import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import {
  createWorldPreset,
  listPublishedWorldPresets,
  listWorldPresets,
  listWorldPresetVersions,
  publishWorldPreset,
  reorderWorldPresets,
  restoreWorldPresetVersion,
  saveWorldPresetDraft,
  seedWorldPresets,
  setWorldPresetArchived
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
  it("starts a new draft after a publish and never rewrites the published version", async () => {
    const { client } = setup();
    await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 2 });
    const published = await publishWorldPreset(client, "eurth");
    const next = await saveWorldPresetDraft(client, ADMIN, "eurth", { riverDensity: 4 });
    expect(next.draft?.versionId).not.toBe(published.published?.versionId);
    expect(next.published).toEqual(published.published);
  });
});

describe("versions, restore, reset to factory", () => {
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
});

describe("what founders get", () => {
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
