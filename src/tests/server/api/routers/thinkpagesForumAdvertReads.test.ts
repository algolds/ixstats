/** @jest-environment node */
/**
 * What the forum router returns for a Find a Realm advert: the row mark and the page's advert view, never the raw
 * realm row that was joined to read it (it carries the founder's Clerk id), and a hidden realm's advert reads as gone.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { banRow, forumBanFake } from "~/tests/helpers/forum-ban-fake";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const caller = (user: object | null, db: object) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: (user as { clerkUserId: string }).clerkUserId } : null,
      user: user as never,
      db,
    }) as never
  );

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: "c1",
  email: "x@y.z",
  role: { name: "user", level: 100 },
};
const founder = { ...member, id: "u_f", clerkUserId: "founder" };
const officer = { ...member, id: "u_off", clerkUserId: "officer" };
/** Wrote the advert (u_f) but no longer manages the realm. */
const exOfficer = { ...member, id: "u_f", clerkUserId: "ex_officer" };
const admin = {
  ...member,
  id: "u_admin",
  clerkUserId: "admin",
  role: { name: "admin", level: 10 },
};

const find = {
  id: "cat_find",
  scope: "site",
  realmId: null,
  style: "ooc",
  ...SITE_CATEGORIES.find((c) => c.key === "find-a-realm")!,
  order: 1,
};
const when = new Date("2026-10-01");
const look = { thumbnail: "/t.png", emblemUrl: "/e.png" };
const ACTIVE = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
  ...look,
};
const DRAFT = { ...ACTIVE, status: "draft" };
const ARCHIVED = { ...ACTIVE, status: "archived" };

function advertDb(advertRealm: object, grants: object[] = [], firstPostId = "p1") {
  return {
    ...engagementTables(),
    forumBan: forumBanFake([]),
    forumCategory: {
      findMany: jest.fn(async () => [find]),
      findFirst: jest.fn(async () => find),
    },
    forumThread: {
      groupBy: jest.fn(async () => []),
      findMany: jest.fn(async (args?: { select?: { reads?: object } }): Promise<object[]> =>
        args?.select?.reads
          ? []
          : [
              {
                id: "t_ad",
                title: "Join Eurth",
                authorUserId: "u_f",
                authorPersonaId: null,
                pinned: false,
                locked: false,
                postCount: 1,
                lastPostAt: when,
                advertRealm,
              },
            ]
      ),
      count: jest.fn(async () => 1),
      findUnique: jest.fn(async () => ({
        id: "t_ad",
        title: "Join Eurth",
        categoryId: find.id,
        authorUserId: "u_f",
        authorPersonaId: null,
        hidden: false,
        locked: false,
        archived: false,
        category: find,
        advertRealm,
      })),
    },
    forumPost: {
      findMany: jest.fn(async () => [
        {
          id: "p1",
          threadId: "t_ad",
          authorUserId: "u_f",
          authorPersonaId: null,
          contentHtml: "<p>Come</p>",
          editedAt: null,
          createdAt: when,
        },
        {
          id: "p2",
          threadId: "t_ad",
          authorUserId: "u1",
          authorPersonaId: null,
          contentHtml: "<p>Is it open?</p>",
          editedAt: null,
          createdAt: when,
        },
      ]),
      findFirst: jest.fn(async () => ({ id: firstPostId })),
      count: jest.fn(async () => 2),
      groupBy: jest.fn(async () => []),
    },
    user: { findMany: jest.fn(async () => []) },
    thinkpagesAccount: { findMany: jest.fn(async () => []) },
    realm: { findMany: jest.fn(async () => []) },
    realmOfficer: { findMany: jest.fn(async (_args?: object) => grants) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  };
}

describe("an advert in the board list", () => {
  it("carries the advert mark and never the joined realm row or its founder", async () => {
    const out = await caller(member, advertDb(ACTIVE)).category({ key: "find-a-realm", page: 1 });
    expect(out.threads[0]!.advert).toEqual({
      realmSlug: "eurth",
      realmName: "Eurth",
      emblemUrl: "/e.png",
      thumbnail: "/t.png",
      claimsOpen: true,
    });
    expect(out.threads[0]).not.toHaveProperty("advertRealm");
    expect(JSON.stringify(out)).not.toContain("ownerId");
    expect(JSON.stringify(out)).not.toContain("founder");
  });

  it("marks an ordinary thread as no advert", async () => {
    const out = await caller(member, advertDb(null as never)).category({
      key: "find-a-realm",
      page: 1,
    });
    expect(out.threads[0]!.advert).toBeNull();
  });
});

describe("an advert on the thread page", () => {
  it("returns the advert view and never the joined realm row or its founder", async () => {
    const out = await caller(member, advertDb(ACTIVE)).thread({ threadId: "t_ad", page: 1 });
    expect(out.advert).toEqual({
      realmSlug: "eurth",
      realmName: "Eurth",
      canManage: false,
      closed: false,
      canLock: false,
    });
    expect(out).not.toHaveProperty("advertRealm");
    expect(JSON.stringify(out)).not.toContain("ownerId");
    expect(JSON.stringify(out)).not.toContain('"founder"');
  });

  it("tells the founder they manage it, and an archived realm's advert that it is closed", async () => {
    expect(
      (await caller(founder, advertDb(ACTIVE)).thread({ threadId: "t_ad", page: 1 })).advert
    ).toMatchObject({ canManage: true, closed: false });
    expect(
      (await caller(member, advertDb(ARCHIVED)).thread({ threadId: "t_ad", page: 1 })).advert
    ).toMatchObject({ canManage: false, closed: true });
  });

  it("reads a draft realm's advert as not found to a member and shows it to the founder", async () => {
    await expect(
      caller(member, advertDb(DRAFT)).thread({ threadId: "t_ad", page: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller(founder, advertDb(DRAFT)).thread({ threadId: "t_ad", page: 1 })
    ).resolves.toMatchObject({ advert: { realmSlug: "eurth" } });
  });

  it("reads an archived realm's advert as locked, closed to replies, edits and reactions, without storing it", async () => {
    const out = await caller(member, advertDb(ARCHIVED)).thread({ threadId: "t_ad", page: 1 });
    expect(out.thread.locked).toBe(true);
    expect(out.canReply).toBe(false);
    expect(out.canReact).toBe(false);
    expect(out.posts.every((p) => !p.isOwn)).toBe(true);
    const open = await caller(member, advertDb(ACTIVE)).thread({ threadId: "t_ad", page: 1 });
    expect(open.thread.locked).toBe(false);
    expect(open.canReply).toBe(true);
    expect(open.canReact).toBe(true);
  });

  it("offers the first post's Edit to whoever manages the advert, though another wrote it, and a reply's to its author", async () => {
    const grants = [{ userId: "officer", powers: ["appearance"] }];
    const manager = await caller(officer, advertDb(ACTIVE, grants)).thread({
      threadId: "t_ad",
      page: 1,
    });
    expect(manager.advert?.canManage).toBe(true);
    expect(manager.posts.map((p) => [p.number, p.isOwn])).toEqual([
      [1, true],
      [2, false],
    ]);
    const reader = await caller(officer, advertDb(ACTIVE)).thread({ threadId: "t_ad", page: 1 });
    expect(reader.posts.map((p) => p.isOwn)).toEqual([false, false]);
    const replier = await caller(member, advertDb(ACTIVE)).thread({ threadId: "t_ad", page: 1 });
    expect(replier.posts.map((p) => p.isOwn)).toEqual([false, true]);
  });

  it("decides the first post by the thread's first post, so a hidden first post does not move Edit to the next", async () => {
    const grants = [{ userId: "officer", powers: ["appearance"] }];
    const out = await caller(officer, advertDb(ACTIVE, grants, "p_hidden_first")).thread({
      threadId: "t_ad",
      page: 1,
    });
    expect(out.posts.map((p) => p.isOwn)).toEqual([false, false]);
  });

  it("does not offer the first post's Edit to its author once they no longer manage the advert", async () => {
    const out = await caller(exOfficer, advertDb(ACTIVE)).thread({ threadId: "t_ad", page: 1 });
    expect(out.advert?.canManage).toBe(false);
    expect(out.posts[0]).toMatchObject({ byViewer: true, isOwn: false });
    const founderOut = await caller(founder, advertDb(ACTIVE)).thread({
      threadId: "t_ad",
      page: 1,
    });
    expect(founderOut.posts[0]).toMatchObject({ byViewer: true, isOwn: true });
  });

  it("has no advert for an ordinary thread", async () => {
    const out = await caller(member, advertDb(null as never)).thread({ threadId: "t_ad", page: 1 });
    expect(out.advert).toBeNull();
  });
});

describe("who may lock an advert, as the thread page is told", () => {
  const rights = async (viewer: object, db: object) =>
    (await caller(viewer, db).thread({ threadId: "t_ad", page: 1 })).advert;
  const grants = [{ userId: "officer", powers: ["appearance"] }];
  const bannedFrom = (db: object, userId: string) => ({
    ...db,
    forumBan: forumBanFake([banRow({ userId, scope: "site" })]),
  });
  /** The viewer also moderates the Find a Realm category. */
  const moderating = (db: object) => ({
    ...db,
    forumCategoryModerator: { findMany: jest.fn(async () => [{ categoryId: "cat_find" }]) },
  });
  const hidden = (db: ReturnType<typeof advertDb>) => ({
    ...db,
    forumThread: {
      ...db.forumThread,
      findUnique: jest.fn(async () => ({
        ...(await db.forumThread.findUnique()),
        hidden: true,
      })),
    },
  });

  it("lets a manager lock it and nobody who only reads it", async () => {
    expect(await rights(founder, advertDb(ACTIVE))).toMatchObject({ canLock: true });
    expect(await rights(officer, advertDb(ACTIVE, grants))).toMatchObject({ canLock: true });
    expect(await rights(officer, advertDb(ACTIVE))).toMatchObject({ canLock: false });
    expect(await rights(member, advertDb(ACTIVE))).toMatchObject({ canLock: false });
  });

  it("does not offer an unlock flag: unlocking is the moderator's, in the thread bar", async () => {
    expect(await rights(admin, advertDb(ACTIVE))).not.toHaveProperty("canUnlock");
  });

  it("offers it to a manager who is also a moderator of the category", async () => {
    expect(await rights(officer, moderating(advertDb(ACTIVE, grants)))).toMatchObject({
      canManage: true,
      canLock: true,
    });
  });

  it("offers nothing on a hidden advert, which setAdvertLocked answers as not found", async () => {
    const db = moderating(hidden(advertDb(ACTIVE, grants)));
    expect(await rights(officer, db)).toMatchObject({ canManage: true, canLock: false });
    expect(await rights(admin, hidden(advertDb(ACTIVE)))).toMatchObject({ canLock: false });
  });

  it("offers nothing on an archived realm's advert, which stays locked", async () => {
    expect(await rights(founder, advertDb(ARCHIVED))).toMatchObject({
      closed: true,
      canLock: false,
    });
    expect(await rights(admin, advertDb(ARCHIVED))).toMatchObject({ canLock: false });
  });

  it("offers nothing to a viewer banned from the board, founder or appearance officer", async () => {
    expect(await rights(founder, bannedFrom(advertDb(ACTIVE), "u_f"))).toMatchObject({
      canLock: false,
    });
    expect(
      await rights(officer, bannedFrom(moderating(advertDb(ACTIVE, grants)), "u_off"))
    ).toMatchObject({ canManage: true, canLock: false });
  });
});

describe("starting a thread in Find a Realm", () => {
  it("is never offered by the generic New thread, to a member or a site admin", async () => {
    for (const viewer of [member, admin, founder]) {
      const out = await caller(viewer, advertDb(ACTIVE)).category({ key: "find-a-realm", page: 1 });
      expect(out.canStart).toBe(false);
    }
  });
});
