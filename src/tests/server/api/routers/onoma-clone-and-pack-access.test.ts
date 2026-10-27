/** @jest-environment node */
/**
 * Onoma's reads of another user's work: `cloneDictionary` copies a public NameBank or one of the caller's own, and
 * another user's private dictionary is missing to them (nothing is stashed); `saveSystem` attaches a writing
 * system only to the caller's own language pack or a shared (public or unlisted) one, never to another user's
 * draft.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/shared/default-stash", () => ({
  getOrCreateDefaultStash: jest.fn().mockResolvedValue({ id: "stash1" }),
}));

import { describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { onomaNameBankRouter } from "~/server/api/routers/onoma/namebank";
import { onomaWritingRouter } from "~/server/api/routers/onoma/writing";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const asAna = (db: MockPrismaProxy) =>
  createMockRouterContext({
    db,
    auth: { userId: "clerk_ana" },
    user: { id: "ana", clerkUserId: "clerk_ana", role: { name: "user", level: 100 } },
  }) as never;

interface Where {
  id: string;
  OR: Array<Record<string, unknown>>;
}
/** `findFirst` over `rows` as Prisma reads `{ id, OR: [...] }` (equality, or `{ in: [...] }`). */
const findFirstOver =
  <T extends Record<string, unknown>>(rows: T[]) =>
  async ({ where }: { where: Where }) =>
    rows.find(
      (row) =>
        row.id === where.id &&
        where.OR.some((clause) =>
          Object.entries(clause).every(([key, want]) =>
            want && typeof want === "object" && "in" in want
              ? (want.in as unknown[]).includes(row[key])
              : row[key] === want
          )
        )
    ) ?? null;

describe("cloneDictionary", () => {
  const banks = [
    { id: "public", userId: "ben", isPublic: true, title: "Towns", category: "c", values: [] },
    { id: "bens", userId: "ben", isPublic: false, title: "Secret", category: "c", values: [] },
    { id: "anas", userId: "ana", isPublic: false, title: "Mine", category: "c", values: [] },
  ];
  const dbWithBanks = () => {
    const db = createMockPrisma();
    db.nameBank.findFirst.mockImplementation(findFirstOver(banks));
    db.stashItem.upsert.mockImplementation(async ({ create }: { create: object }) => ({
      id: "item1",
      createdAt: new Date(),
      ...create,
      stash: { id: "stash1", name: "My Stash", color: null, userId: "ana" },
    }));
    return db;
  };

  it("finds another user's private dictionary missing, and stashes nothing", async () => {
    const db = dbWithBanks();
    await expect(
      createCallerFactory(onomaNameBankRouter)(asAna(db)).cloneDictionary({ id: "bens" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.stashItem.upsert).not.toHaveBeenCalled();
  });

  it.each(["public", "anas"])("clones %s", async (id) => {
    const db = dbWithBanks();
    const clone = await createCallerFactory(onomaNameBankRouter)(asAna(db)).cloneDictionary({
      id,
    });
    expect(clone).toMatchObject({ clonedFromId: id });
  });
});

describe("saveSystem", () => {
  const packs = [
    { id: "anas-draft", userId: "ana", visibility: "draft" },
    { id: "bens-draft", userId: "ben", visibility: "draft" },
    { id: "bens-public", userId: "ben", visibility: "public" },
    { id: "bens-unlisted", userId: "ben", visibility: "unlisted" },
  ];
  const dbWithPacks = () => {
    const db = createMockPrisma();
    db.languagePack.findFirst.mockImplementation(findFirstOver(packs));
    db.writingSystem.create.mockImplementation(async ({ data }: { data: object }) => ({
      id: "ws1",
      ...data,
    }));
    return db;
  };

  it("refuses another user's draft pack, writing nothing", async () => {
    const db = dbWithPacks();
    await expect(
      createCallerFactory(onomaWritingRouter)(asAna(db)).saveSystem({
        name: "Runes",
        languagePackId: "bens-draft",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.writingSystem.create).not.toHaveBeenCalled();
  });

  it.each(["anas-draft", "bens-public", "bens-unlisted"])(
    "attaches to %s",
    async (languagePackId) => {
      const db = dbWithPacks();
      await expect(
        createCallerFactory(onomaWritingRouter)(asAna(db)).saveSystem({
          name: "Runes",
          languagePackId,
        })
      ).resolves.toMatchObject({ languagePackId, userId: "ana" });
    }
  );

  it("saves a system with no pack without looking one up", async () => {
    const db = dbWithPacks();
    await createCallerFactory(onomaWritingRouter)(asAna(db)).saveSystem({ name: "Runes" });
    expect(db.languagePack.findFirst).not.toHaveBeenCalled();
    expect(db.writingSystem.create).toHaveBeenCalledTimes(1);
  });
});
