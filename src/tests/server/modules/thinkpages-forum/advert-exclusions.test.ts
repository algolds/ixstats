/** @jest-environment node */
/**
 * A hidden realm's advert leaves every read: the board table and its count, the Forums home counts and latest post, the
 * public feed's where, Trending, the thread read, the permalink lookup, stash titles, the unread counts, and the writes
 * that find a thread by id.
 */
import { advertGate, ADVERT_REALM_SELECT } from "~/server/modules/thinkpages-forum/advert-access";
import {
  latestPerCategory,
  postCountsPerCategory,
  trendingThreads,
} from "~/server/modules/thinkpages-forum/board-reads";
import { resolvePostLocation } from "~/server/modules/thinkpages-forum/post-location";
import { publicThreadWhere } from "~/server/modules/thinkpages-forum/public-threads";
import {
  getCategoryThreads,
  loadVisibleThread,
  summarizeCategories,
} from "~/server/modules/thinkpages-forum/reads";
import { readableThreadTitles } from "~/server/modules/thinkpages-forum/stash";
import { editPost, replyToThread } from "~/server/modules/thinkpages-forum/writes";
import { withUnreadCounts } from "~/server/modules/thinkpages-forum/unread-attach";
import { forumBanFake } from "~/tests/helpers/forum-ban-fake";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const founder = {
  id: "u_f",
  clerkUserId: "founder",
  countryId: "c1",
  role: { name: "user", level: 100 },
};
const member = {
  id: "u_m",
  clerkUserId: "member",
  countryId: "c4",
  role: { name: "user", level: 100 },
};

const look = { thumbnail: null, emblemUrl: null };
const ACTIVE = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
  ...look,
};
const DRAFT = {
  id: "r_draft",
  slug: "draft-land",
  name: "Draft Land",
  status: "draft",
  ownerId: "founder",
  ...look,
};
const ARCHIVED = { ...ACTIVE, status: "archived" };

const category = {
  id: "cat_find",
  scope: "site",
  realmId: null,
  key: "find-a-realm",
  name: "Find a Realm",
  description: null,
  icAllowed: false,
  postRole: "any",
  visibility: "public",
  style: "ooc",
  order: 50,
};

const threadRow = (advertRealm: object | null, extra: object = {}) => ({
  id: "t_ad",
  categoryId: category.id,
  title: "Join Eurth",
  authorUserId: "u_f",
  authorPersonaId: null,
  importedAuthorName: null,
  xenforoThreadId: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
  postCount: 1,
  lastPostAt: new Date("2026-10-01"),
  createdAt: new Date("2026-10-01"),
  category,
  advertRealm,
  ...extra,
});

describe("lists and counts take the gate", () => {
  it("applies it to the board's thread list and its count", async () => {
    const db = {
      realm: { findUnique: jest.fn(async () => null) },
      forumCategory: { findFirst: jest.fn(async () => category) },
      forumThread: {
        findMany: jest.fn(async (_args?: object) => [] as object[]),
        count: jest.fn(async (_args?: object) => 0),
      },
    };
    await getCategoryThreads(db as never, member, { key: "find-a-realm" }, 1);
    const gate = advertGate(member);
    const list = db.forumThread.findMany.mock.calls[0]![0] as {
      where: object;
      select: { advertRealm: object };
    };
    expect(list.where).toEqual(expect.objectContaining(gate));
    expect(list.select.advertRealm).toEqual({ select: ADVERT_REALM_SELECT });
    expect(db.forumThread.count).toHaveBeenCalledWith({ where: expect.objectContaining(gate) });
  });

  it("applies it to the Forums home thread counts", async () => {
    const db = { forumThread: { groupBy: jest.fn(async (_args?: object) => [] as object[]) } };
    await summarizeCategories(db as never, member, [category as never]);
    expect(db.forumThread.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(advertGate(member)) })
    );
  });

  it("applies it to the post counts and the latest post of a board", async () => {
    const db = {
      forumThread: {
        groupBy: jest.fn(async (_args?: object) => [] as object[]),
        findMany: jest.fn(async (_args?: object) => [] as object[]),
      },
      forumPost: { findMany: jest.fn(async () => [] as object[]) },
    };
    await postCountsPerCategory(db as never, member, [category]);
    await latestPerCategory(db as never, member, [category]);
    const gate = advertGate(member);
    for (const call of [
      db.forumThread.groupBy.mock.calls[0]!,
      db.forumThread.findMany.mock.calls[0]!,
    ]) {
      const where = (call[0] as { where: { OR: object[] } }).where;
      expect(where.OR[0]).toEqual(expect.objectContaining(gate));
    }
  });

  it("applies the anonymous gate to the public feed, statistics and passport footprint", async () => {
    const where = await publicThreadWhere({
      realm: { findMany: jest.fn(async () => []) },
    } as never);
    expect(where).toEqual(expect.objectContaining(advertGate(null)));
  });

  it("applies the anonymous gate to Trending", async () => {
    const db = {
      realm: { findMany: jest.fn(async () => []) },
      forumPost: { groupBy: jest.fn(async (_args?: object) => [] as object[]) },
      forumThread: { findMany: jest.fn(async () => [] as object[]) },
    };
    await trendingThreads(db as never, member);
    const where = (db.forumPost.groupBy.mock.calls[0]![0] as { where: { thread: object } }).where;
    expect(where.thread).toEqual(expect.objectContaining(advertGate(null)));
  });

  it("does not gate a site admin's lists", async () => {
    const db = {
      realm: { findUnique: jest.fn(async () => null) },
      forumCategory: { findFirst: jest.fn(async () => category) },
      forumThread: {
        findMany: jest.fn(async (_args?: object) => [] as object[]),
        count: jest.fn(async (_args?: object) => 0),
      },
    };
    await getCategoryThreads(db as never, admin, { key: "find-a-realm" }, 1);
    const where = (db.forumThread.findMany.mock.calls[0]![0] as { where: object }).where;
    expect(where).not.toHaveProperty("AND");
  });
});

describe("single reads leave out a hidden realm's advert", () => {
  const threadDb = (advertRealm: object | null) => ({
    realm: { findUnique: jest.fn(async () => null) },
    forumThread: { findUnique: jest.fn(async () => threadRow(advertRealm)) },
  });

  it("reads a draft realm's advert as not found to a member and shows it to the founder and an admin", async () => {
    await expect(loadVisibleThread(threadDb(DRAFT) as never, member, "t_ad")).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      }
    );
    await expect(loadVisibleThread(threadDb(DRAFT) as never, null, "t_ad")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      loadVisibleThread(threadDb(DRAFT) as never, founder, "t_ad")
    ).resolves.toMatchObject({
      advertRealm: DRAFT,
    });
    await expect(loadVisibleThread(threadDb(DRAFT) as never, admin, "t_ad")).resolves.toMatchObject(
      {
        advertRealm: DRAFT,
      }
    );
  });

  it("returns the advertised realm of a published advert and no realm for an ordinary thread", async () => {
    const out = await loadVisibleThread(threadDb(ACTIVE) as never, member, "t_ad");
    expect(out.advertRealm).toEqual(ACTIVE);
    expect(out.thread).not.toHaveProperty("advertRealm");
    expect(
      (await loadVisibleThread(threadDb(null) as never, member, "t_ad")).advertRealm
    ).toBeNull();
  });

  it("joins the realm row in the thread select", async () => {
    const db = threadDb(ACTIVE);
    await loadVisibleThread(db as never, member, "t_ad");
    const [[call]] = db.forumThread.findUnique.mock.calls as never as [
      [{ select: { advertRealm?: object } }],
    ];
    expect(call.select.advertRealm).toEqual({ select: ADVERT_REALM_SELECT });
  });

  it("resolves a post permalink to nothing for a member of a hidden realm's advert", async () => {
    const post = (advertRealm: object) => ({
      id: "p1",
      threadId: "t_ad",
      createdAt: new Date("2026-10-01"),
      hidden: false,
      thread: { authorUserId: "u_f", hidden: false, category, advertRealm },
    });
    const db = (advertRealm: object) => ({
      realm: { findUnique: jest.fn(async () => null) },
      forumPost: {
        findUnique: jest.fn(async () => post(advertRealm)),
        count: jest.fn(async () => 0),
      },
    });
    await expect(resolvePostLocation(db(DRAFT) as never, member, "p1")).resolves.toBeNull();
    await expect(resolvePostLocation(db(DRAFT) as never, founder, "p1")).resolves.toEqual({
      threadId: "t_ad",
      page: 1,
    });
    await expect(resolvePostLocation(db(ACTIVE) as never, member, "p1")).resolves.toEqual({
      threadId: "t_ad",
      page: 1,
    });
  });

  it("gives a stash no title for a hidden realm's advert", async () => {
    const rows = [
      {
        id: "t_hidden",
        title: "Hidden advert",
        authorUserId: "u_f",
        hidden: false,
        category,
        advertRealm: DRAFT,
      },
      {
        id: "t_shown",
        title: "Shown advert",
        authorUserId: "u_f",
        hidden: false,
        category,
        advertRealm: ACTIVE,
      },
      {
        id: "t_plain",
        title: "Plain",
        authorUserId: "u_f",
        hidden: false,
        category,
        advertRealm: null,
      },
    ];
    const db = {
      realm: { findUnique: jest.fn(async () => null) },
      forumThread: { findMany: jest.fn(async () => rows) },
    };
    const titles = await readableThreadTitles(db as never, member, [
      "t_hidden",
      "t_shown",
      "t_plain",
    ]);
    expect([...titles.keys()].sort()).toEqual(["t_plain", "t_shown"]);
  });
});

describe("writes that find a thread by id", () => {
  const replyDb = (advertRealm: object) => ({
    forumBan: forumBanFake([]),
    realm: { findUnique: jest.fn(async () => null) },
    forumThread: { findUnique: jest.fn(async () => threadRow(advertRealm)) },
  });

  it("answers a reply to a hidden realm's advert as not found", async () => {
    await expect(
      replyToThread(replyDb(DRAFT) as never, member, { threadId: "t_ad", html: "<p>hi</p>" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("closes replies to an archived realm's advert", async () => {
    await expect(
      replyToThread(replyDb(ARCHIVED) as never, member, { threadId: "t_ad", html: "<p>hi</p>" })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "This thread is closed to replies." });
  });

  const editDb = (advertRealm: object, authorUserId = "u_m") => ({
    forumBan: forumBanFake([]),
    realm: { findUnique: jest.fn(async () => null) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumPost: {
      findUnique: jest.fn(async () => ({
        id: "p1",
        threadId: "t_ad",
        authorUserId,
        hidden: false,
        contentWikitext: null,
        thread: {
          authorUserId: "u_m",
          hidden: false,
          locked: false,
          archived: false,
          category,
          advertRealm,
        },
      })),
      findFirst: jest.fn(async () => ({ id: "p1" })),
    },
  });
  const edit = { postId: "p1", html: "<p>new</p>", editedAt: null };

  it("answers an edit of a hidden realm's advert as not found, even by its author", async () => {
    await expect(editPost(editDb(DRAFT) as never, member, edit)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("closes edits of an archived realm's advert, even to the founder who manages it", async () => {
    await expect(editPost(editDb(ARCHIVED, "u_f") as never, founder, edit)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This thread is closed to edits.",
    });
  });
});

describe("unread counts", () => {
  it("leave out a hidden realm's advert", async () => {
    const fresh = new Date();
    const db = {
      ...engagementTables(),
      forumCategory: {
        findMany: jest.fn(async () => [
          { id: "cat_find", scope: "site", realmId: null, visibility: "public" },
        ]),
      },
      forumThread: {
        findMany: jest.fn(async (_args?: object) => [
          { categoryId: "cat_find", lastPostAt: fresh, reads: [], advertRealm: DRAFT },
          { categoryId: "cat_find", lastPostAt: fresh, reads: [], advertRealm: ACTIVE },
          { categoryId: "cat_find", lastPostAt: fresh, reads: [], advertRealm: null },
        ]),
      },
    };
    const [row] = await withUnreadCounts(db as never, member, [{ id: "cat_find" }]);
    expect(row!.unreadThreads).toBe(2);
    const select = (
      db.forumThread.findMany.mock.calls[0]![0] as { select: { advertRealm?: object } }
    ).select;
    expect(select.advertRealm).toEqual({ select: ADVERT_REALM_SELECT });
  });
});
