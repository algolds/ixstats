/** @jest-environment node */
/**
 * SL-18: a language-pack owner can start a draft pack from their dictionaries, publish it (public
 * or unlisted) once it passes validation, and unpublish it. Other users' drafts stay private.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { onomaMarketplaceRouter } from "~/server/api/routers/onoma/marketplace";
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
  it("does not fork another user's draft", async () => {
    const db = createMockPrisma();
    db.languagePack.findUnique.mockResolvedValue({ ...goodPack, userId: "someone_else" });
    await expect(caller(ctx(db)).fork({ packId: "pack1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.languagePack.create).not.toHaveBeenCalled();
  });
});
