/** @jest-environment node */
/**
 * SL-18: a language-pack owner can start a draft pack from their dictionaries, publish it (public
 * or unlisted) once it passes validation, and unpublish it. Other users' drafts stay private.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { onomaMarketplaceRouter } from "~/server/api/routers/onoma/marketplace";
import { packPublishProblems, readPackDictionaries } from "~/lib/onoma/pack-publish";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const caller = createCallerFactory(onomaMarketplaceRouter);

function ctx(db: ReturnType<typeof createMockPrisma>) {
  return createMockRouterContext({
    db,
    auth: { userId: "clerk_owner" },
    user: { id: "owner", clerkUserId: "clerk_owner", role: { name: "user", level: 100 } },
  }) as never;
}

const words = Array.from({ length: 12 }, (_, i) => `name${i}`);
const goodVersion = {
  dictionaries: [{ name: "Towns", category: "city", values: words }],
  phonologyRules: null,
  morphologyRules: null,
  orthographyRules: null,
  namingConventions: null,
};
const goodPack = {
  id: "pack1",
  userId: "owner",
  name: "Northern Towns",
  description: "Town names drawn from the northern dialects.",
  tags: ["towns"],
  visibility: "draft",
  versions: [goodVersion],
};

describe("packPublishProblems", () => {
  it("passes a described pack with a large enough dictionary", () => {
    expect(packPublishProblems(goodPack, goodVersion)).toEqual([]);
  });

  it("explains every missing piece", () => {
    const problems = packPublishProblems(
      { name: "X", description: "short", tags: [] },
      { ...goodVersion, dictionaries: [{ name: "Tiny", values: ["a", "b"] }] }
    );
    expect(problems).toHaveLength(3);
    expect(packPublishProblems(goodPack, null)).toEqual(["The pack has no version to publish."]);
  });

  it("accepts rules in place of a dictionary", () => {
    expect(
      packPublishProblems(goodPack, {
        ...goodVersion,
        dictionaries: [],
        phonologyRules: { onsets: ["k"] },
      })
    ).toEqual([]);
  });

  it("reads only well-formed stored dictionaries", () => {
    expect(readPackDictionaries([{ name: "A", values: ["x", " ", 3] }, { values: [] }, 7])).toEqual(
      [{ name: "A", category: null, values: ["x"] }]
    );
    expect(readPackDictionaries(null)).toEqual([]);
  });
});

describe("onoma marketplace publishing", () => {
  it("publishes the owner's valid pack", async () => {
    const db = createMockPrisma();
    db.languagePack.findUnique.mockResolvedValue(goodPack);
    db.languagePack.update.mockResolvedValue({ ...goodPack, visibility: "public" });

    await caller(ctx(db)).publishPack({ packId: "pack1" });

    expect(db.languagePack.update).toHaveBeenCalledWith({
      where: { id: "pack1" },
      data: { visibility: "public" },
    });
  });

  it("refuses an invalid pack with the reasons", async () => {
    const db = createMockPrisma();
    db.languagePack.findUnique.mockResolvedValue({ ...goodPack, description: null });
    await expect(caller(ctx(db)).publishPack({ packId: "pack1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("description"),
    });
    expect(db.languagePack.update).not.toHaveBeenCalled();
  });

  it("treats someone else's pack as missing for publish and unpublish", async () => {
    const db = createMockPrisma();
    db.languagePack.findUnique.mockResolvedValue({ ...goodPack, userId: "someone_else" });
    await expect(caller(ctx(db)).publishPack({ packId: "pack1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller(ctx(db)).unpublishPack({ packId: "pack1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.languagePack.update).not.toHaveBeenCalled();
  });

  it("unpublishes back to draft", async () => {
    const db = createMockPrisma();
    db.languagePack.findUnique.mockResolvedValue({ ...goodPack, visibility: "public" });
    await caller(ctx(db)).unpublishPack({ packId: "pack1" });
    expect(db.languagePack.update).toHaveBeenCalledWith({
      where: { id: "pack1" },
      data: { visibility: "draft" },
    });
  });

  it("creates a draft pack with one version from the picked dictionaries", async () => {
    const db = createMockPrisma();
    db.languagePack.create.mockResolvedValue({ id: "new" });
    await caller(ctx(db)).createPack({
      name: "Coastal Names",
      dictionaries: [{ name: "Ports", values: ["Ana", "Ana", "Bel"] }],
    });
    expect(db.languagePack.create.mock.calls[0]![0].data).toMatchObject({
      userId: "owner",
      name: "Coastal Names",
      visibility: "draft",
    });
    expect(db.languagePackVersion.create.mock.calls[0]![0].data).toMatchObject({
      packId: "new",
      version: 1,
      dictionaries: [{ name: "Ports", category: null, values: ["Ana", "Bel"] }],
    });
  });

  it("does not fork another user's draft", async () => {
    const db = createMockPrisma();
    db.languagePack.findUnique.mockResolvedValue({ ...goodPack, userId: "someone_else" });
    await expect(caller(ctx(db)).fork({ packId: "pack1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.languagePack.create).not.toHaveBeenCalled();
  });
});
