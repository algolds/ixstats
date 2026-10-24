/** @jest-environment node */
/**
 * Readers and profiles on the claim resolver (IxnayID P2). `users.resolveWikiAuthor` ties a wiki name to an account
 * only through an approved claim its owner shows, else through the passport handle the name spells: a pending or a
 * hidden claim answers null. `users.wikiUserPageOwner` names the passport a `User:` page opens, by the same rule. The wiki talk bridge reads the talk page of the user's first approved claim (a hidden one
 * too: it is their own inbox), else of their handle.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
  isDatabaseReadOnly: false,
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
}));

import type { PrismaClient } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addCountry, addRealm } from "~/tests/helpers/money-world";
import { createMockCallerContext } from "~/tests/helpers/router-context";

let db: MemoryPrisma;
const asPrisma = () => db as unknown as PrismaClient;

const claim = (userId: string, name: string, over: object = {}) =>
  db.wikiNameClaim.create({
    data: {
      userId,
      name,
      status: "APPROVED",
      origin: "PLAYER",
      requestedById: userId,
      decidedAt: new Date("2026-10-01T00:00:00Z"),
      ...over,
    },
  });

beforeEach(async () => {
  mockDb = db = createMemoryPrisma();
  const { id: realmId } = await addRealm(asPrisma(), "ixnay");
  const member = await db.role.create({
    data: { name: "member", displayName: "Member", level: 100 },
  });
  await db.user.create({
    data: { id: "a", clerkUserId: "user_a", handle: "alpha", roleId: member.id },
  });
  await db.user.create({ data: { id: "b", clerkUserId: "user_b", handle: "foo_bar" } });
  await db.user.create({ data: { id: "c", clerkUserId: "user_c" } });
  await addCountry(asPrisma(), "eldoria", realmId, "a");
  await db.user.update({ where: { id: "a" }, data: { countryId: "eldoria" } });
});

describe("users.resolveWikiAuthor", () => {
  const resolve = (wikiUsername: string) =>
    createCallerFactory(usersPreferencesRouter)(
      createMockCallerContext({
        db: mockDb,
        auth: null,
        user: null,
        rateLimitIdentifier: `test:${Math.random()}`,
      })
    ).resolveWikiAuthor({ wikiUsername });

  it("ties a shown claim's name to the account's role and country", async () => {
    await claim("a", "Old name");

    expect(await resolve("Old_name")).toEqual({
      wikiUsername: "Old_name",
      role: { name: "member", displayName: "Member" },
      country: expect.objectContaining({ id: "eldoria", name: "Nation eldoria" }),
    });
  });

  it("answers null for a hidden claim's name, never the handle it might spell", async () => {
    await claim("b", "Foo bar", { visible: false });

    expect(await resolve("Foo bar")).toBeNull();
  });

  it("answers null for a pending claim's name", async () => {
    await claim("a", "Old name", { status: "PENDING", decidedAt: null });

    expect(await resolve("Old name")).toBeNull();
  });

  it("finds the account whose handle an unclaimed name spells", async () => {
    expect(await resolve("Foo bar")).toEqual({
      wikiUsername: "Foo bar",
      role: null,
      country: null,
    });
  });
});

describe("users.wikiUserPageOwner", () => {
  const owner = (name: string) =>
    createCallerFactory(usersPreferencesRouter)(
      createMockCallerContext({
        db: mockDb,
        auth: null,
        user: null,
        rateLimitIdentifier: `test:${Math.random()}`,
      })
    ).wikiUserPageOwner({ name });

  it("names the passport handle of a shown claim's owner", async () => {
    await claim("a", "Old name");

    expect(await owner("Old_name")).toEqual({ handle: "alpha" });
  });

  it("names the handle an unclaimed name spells", async () => {
    expect(await owner("Foo_bar")).toEqual({ handle: "foo_bar" });
  });

  it("lets an approved claim beat the handle the name spells", async () => {
    await claim("a", "Foo bar");

    expect(await owner("Foo bar")).toEqual({ handle: "alpha" });
  });

  it("answers null for a pending claim's name", async () => {
    await claim("a", "Old name", { status: "PENDING", decidedAt: null });

    expect(await owner("Old name")).toBeNull();
  });

  it("answers null for a hidden claim's name, never the handle it might spell", async () => {
    await claim("a", "Foo bar", { visible: false });

    expect(await owner("Foo bar")).toBeNull();
  });

  it("answers null when the claim's owner has no handle yet", async () => {
    await claim("c", "Old name");

    expect(await owner("Old name")).toBeNull();
  });
});

describe("the wiki talk bridge", () => {
  const talkPage = jest.mocked(getArticleWikitext);
  const conversations = () =>
    db.thinkshareConversation.findMany({ select: { name: true, sourceId: true } });

  beforeEach(() => {
    talkPage.mockReset();
    talkPage.mockResolvedValue({ title: "User talk", pageId: 1, wikitext: "Hello", length: 5 });
  });

  it("reads the talk page of the user's first approved claim, a hidden one included", async () => {
    await claim("a", "Second name", { decidedAt: new Date("2026-10-02T00:00:00Z") });
    await claim("a", "Old name", { visible: false });

    const result = await wikiTalkBridge.syncInbound("user_a", asPrisma());

    expect(talkPage).toHaveBeenCalledWith("User talk:Old_name", "ixwiki");
    expect(result.conversationsCreated).toBe(1);
    expect(await conversations()).toEqual([
      { name: "Talk: Old name", sourceId: "wiki-talk:Old name" },
    ]);
  });

  it("reads the handle's talk page when the user has no approved claim", async () => {
    await claim("b", "Pending name", { status: "PENDING", decidedAt: null });

    await wikiTalkBridge.syncInbound("user_b", asPrisma());

    expect(talkPage).toHaveBeenCalledWith("User talk:foo_bar", "ixwiki");
    expect(await conversations()).toEqual([
      { name: "Talk: foo_bar", sourceId: "wiki-talk:foo_bar" },
    ]);
  });

  it("reads nothing for a user with neither a claim nor a handle", async () => {
    const result = await wikiTalkBridge.syncInbound("user_c", asPrisma());

    expect(talkPage).not.toHaveBeenCalled();
    expect(result.conversationsCreated).toBe(0);
  });
});
