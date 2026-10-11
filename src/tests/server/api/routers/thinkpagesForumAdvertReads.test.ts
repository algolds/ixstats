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
import { forumBanFake } from "~/tests/helpers/forum-ban-fake";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const caller = (user: object | null, db: object) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: user === founder ? "founder" : "clerk_1" } : null,
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

function advertDb(advertRealm: object) {
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
      ]),
      count: jest.fn(async () => 1),
      groupBy: jest.fn(async () => []),
    },
    user: { findMany: jest.fn(async () => []) },
    thinkpagesAccount: { findMany: jest.fn(async () => []) },
    realm: { findMany: jest.fn(async () => []) },
    realmOfficer: { findMany: jest.fn(async () => []) },
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

  it("has no advert for an ordinary thread", async () => {
    const out = await caller(member, advertDb(null as never)).thread({ threadId: "t_ad", page: 1 });
    expect(out.advert).toBeNull();
  });
});
