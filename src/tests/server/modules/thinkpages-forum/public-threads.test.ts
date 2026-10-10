/** @jest-environment node */
/**
 * Phase 4b (Q10): the activity feed, Trending and the forum-link previews read native threads instead of XenForo.
 * Only what an anonymous visitor may read is listed: not hidden, in a public category, in the site section or a
 * published realm (IxWorld, active and archived realms; never a draft or generating one).
 */
import { describe, expect, it, jest } from "@jest/globals";
import {
  latestPublicThreads,
  publicThreadByXenforoId,
} from "~/server/modules/thinkpages-forum/public-threads";

const NOW = new Date("2026-10-09T12:00:00Z");

const THREAD = {
  id: "t1",
  title: "Hello",
  authorUserId: "u1",
  authorPersonaId: null,
  importedAuthorName: null,
  postCount: 3,
  createdAt: NOW,
  lastPostAt: NOW,
  category: { name: "General" },
};

function fakeDb(threads: object[], firstPost: object | null = null) {
  const findMany = jest.fn<(args: object) => Promise<object[]>>().mockResolvedValue(threads);
  const findFirst = jest
    .fn<(args: object) => Promise<object | null>>()
    .mockResolvedValue(threads[0] ?? null);
  const db = {
    forumThread: { findMany, findFirst },
    forumPost: {
      findFirst: jest.fn<(args: object) => Promise<object | null>>().mockResolvedValue(firstPost),
    },
    realm: {
      findMany: jest.fn<(args: object) => Promise<object[]>>().mockResolvedValue([
        { id: "r_active", status: "active" },
        { id: "r_old", status: "archived" },
        { id: "r_draft", status: "draft" },
        { id: "r_gen", status: "generating" },
      ]),
    },
    user: {
      findMany: jest
        .fn<(args: object) => Promise<object[]>>()
        .mockResolvedValue([{ id: "u1", handle: "jane", wikiUsername: null, country: null }]),
    },
    thinkpagesAccount: {
      findMany: jest
        .fn<(args: object) => Promise<object[]>>()
        .mockResolvedValue([{ id: "pa1", displayName: "Herald", username: "herald" }]),
    },
  };
  return { db: db as never, findMany, findFirst };
}

const PUBLIC_WHERE = {
  hidden: false,
  category: {
    visibility: { in: ["public"] },
    style: { not: "board" },
    OR: [{ scope: "site" }, { scope: "realm", realmId: { in: ["default", "r_active", "r_old"] } }],
  },
};

describe("latestPublicThreads", () => {
  it("lists the newest visible threads in public categories of the site and published realms", async () => {
    const { db, findMany } = fakeDb([THREAD]);
    const threads = await latestPublicThreads(db, 20);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: PUBLIC_WHERE,
        orderBy: { lastPostAt: "desc" },
        take: 20,
      })
    );
    expect(threads).toEqual([
      {
        id: "t1",
        title: "Hello",
        author: "jane",
        categoryName: "General",
        replyCount: 2,
        createdAt: NOW,
        lastPostAt: NOW,
        href: "/thinkpages/t/t1",
      },
    ]);
  });

  it("names a persona thread by the persona, an imported one by its XenForo name, else Member", async () => {
    const { db } = fakeDb([
      { ...THREAD, id: "t2", authorPersonaId: "pa1" },
      { ...THREAD, id: "t3", authorUserId: null, importedAuthorName: "OldTimer" },
      { ...THREAD, id: "t4", authorUserId: null, importedAuthorName: null, postCount: 0 },
    ]);
    const threads = await latestPublicThreads(db, 5);
    expect(threads.map((t) => t.author)).toEqual(["Herald", "OldTimer", "Member"]);
    expect(threads[2]!.replyCount).toBe(0);
  });
});

describe("publicThreadByXenforoId", () => {
  it("resolves an imported thread readable by anyone, with its first post as the excerpt", async () => {
    const { db, findFirst } = fakeDb([THREAD], { plainText: "  First   post\nbody  " });
    await expect(publicThreadByXenforoId(db, 123)).resolves.toEqual({
      id: "t1",
      title: "Hello",
      author: "jane",
      categoryName: "General",
      replyCount: 2,
      createdAt: NOW,
      lastPostAt: NOW,
      href: "/thinkpages/t/t1",
      excerpt: "First post body",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { xenforoThreadId: 123, ...PUBLIC_WHERE } })
    );
  });

  it("is null for an id with no public thread", async () => {
    const { db } = fakeDb([]);
    await expect(publicThreadByXenforoId(db, 9)).resolves.toBeNull();
  });
});
