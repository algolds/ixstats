/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum", () => {
  const actual = jest.requireActual("~/server/modules/thinkpages-forum");
  return {
    ...actual,
    createThread: jest.fn(async () => ({
      threadId: "t_new",
      postId: "p_new",
      formatting: "done",
    })),
    afterThreadStarted: jest.fn(async () => undefined),
    afterReply: jest.fn(async () => undefined),
    afterEdit: jest.fn(async () => undefined),
    afterBoardMessage: jest.fn(async () => undefined),
    afterReaction: jest.fn(async () => undefined),
    renderPostWikitext: jest.fn(),
    replyToThread: jest.fn(async () => {
      throw new actual.ForumError("CONFLICT", "This thread is closed to replies.");
    }),
    fileReport: jest.fn(async () => ({ reportId: "rep_1" })),
    fileAppeal: jest.fn(async () => ({ appealId: "ap_1" })),
    myStanding: jest.fn(async () => ({ activePoints: 3, warnings: [], bans: [], appeals: [] })),
    createAdvert: jest.fn(),
  };
});

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { REALM_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { SITE_CATEGORIES } from "~/tests/helpers/forum-site-categories";
import {
  afterThreadStarted,
  createAdvert,
  createThread,
  fileReport,
  ForumError,
} from "~/server/modules/thinkpages-forum";
import { mapError } from "~/server/api/routers/thinkpagesForum/viewer";
import { TRPCError } from "@trpc/server";
import { forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const caller = (user: object | null, db: object = {}) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: "clerk_1" } : null,
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
const admin = { ...member, id: "u_admin", role: { name: "admin", level: 10 } };

const categories = SITE_CATEGORIES.map((c, i) => ({
  id: `cat_${c.key}`,
  scope: "site",
  realmId: null,
  style: "ooc",
  ...c,
  order: i,
}));
const general = categories.find((c) => c.key === "general")!;

const when = new Date("2026-10-01");
const rawUser = {
  id: "u1",
  handle: "heku",
  wikiUsername: "Heku",
  discordUsername: "heku#1",
  email: "secret@example.com",
  clerkUserId: "clerk_1",
};
const rawPersona = {
  id: "pa1",
  displayName: "Caphiria News",
  username: "caphnews",
  clerkUserId: "clerk_1",
  isActive: true,
};

function forumDb(thread: object = {}, bans: BanRow[] = []) {
  return {
    ...engagementTables(),
    forumBan: forumBanFake(bans),
    forumCategory: {
      findMany: jest.fn(async () => categories),
      findFirst: jest.fn(
        async ({ where }: { where: { key: string } }) =>
          categories.find((c) => c.key === where.key) ?? null
      ),
    },
    forumThread: {
      groupBy: jest.fn(async () => []),
      // The unread counts ask for each thread's read mark (select.reads); the list does not. None unread by default.
      findMany: jest.fn(async (args?: { select?: { reads?: object } }): Promise<object[]> =>
        args?.select?.reads
          ? []
          : [
              {
                id: "t1",
                title: "Hello",
                authorUserId: "u1",
                authorPersonaId: "pa1",
                pinned: false,
                locked: false,
                postCount: 2,
                lastPostAt: when,
              },
            ]
      ),
      count: jest.fn(async () => 1),
      findUnique: jest.fn(async () => ({
        id: "t1",
        title: "Hello",
        categoryId: general.id,
        authorUserId: "u1",
        authorPersonaId: null,
        hidden: false,
        locked: false,
        archived: false,
        category: general,
        ...thread,
      })),
    },
    forumPost: {
      findMany: jest.fn(async (_args?: { select?: Record<string, boolean> }) => [
        {
          id: "p1",
          threadId: "t1",
          authorUserId: "u1",
          authorPersonaId: "pa1",
          contentHtml: "<p>hi</p>",
          editedAt: null,
          createdAt: when,
        },
        {
          id: "p2",
          authorUserId: "u2",
          authorPersonaId: null,
          contentHtml: "<p>yo</p>",
          editedAt: null,
          createdAt: when,
        },
      ]),
      count: jest.fn(async () => 2),
      groupBy: jest.fn(async () => []),
    },
    user: {
      findMany: jest.fn(async () => [
        rawUser,
        { ...rawUser, id: "u2", handle: null, wikiUsername: null, discordUsername: "disc#2" },
      ]),
    },
    thinkpagesAccount: { findMany: jest.fn(async () => [rawPersona]) },
    // moderatorContext's lookups: nobody founds a realm, holds an office or moderates a category here.
    realm: { findMany: jest.fn(async () => []) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  };
}

const EURTH = {
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  ownerId: "founder",
  emblemUrl: null,
  thumbnail: null,
};
const hub = {
  id: "rcat_hub",
  scope: "realm",
  realmId: "r_eurth",
  visibility: "public",
  postRole: "any",
  ...REALM_CATEGORIES[0]!,
};
const NO_NATION = "Only owners of a nation in Eurth can post here.";

/** forumDb plus a realm (Eurth) with its Hub, and the realm posting lookups; `owned` are the caller's nations. */
function realmForumDb(owned: Array<{ id: string; realmId: string; currentTotalGdp: number }> = []) {
  const base = forumDb({ categoryId: hub.id, category: hub });
  base.forumCategory.findFirst.mockImplementation((async ({
    where,
  }: {
    where: { scope: string };
  }) => (where.scope === "realm" ? hub : null)) as never);
  base.forumCategory.findMany.mockResolvedValue([hub] as never);
  return {
    ...base,
    realm: {
      findUnique: jest.fn(async () => EURTH),
      // moderatorContext asks for the realms the viewer founded; listForumRealms for all of them.
      findMany: jest.fn(async ({ where }: { where?: { ownerId?: string } } = {}) =>
        [EURTH].filter((r) => where?.ownerId === undefined || r.ownerId === where.ownerId)
      ),
    },
    country: {
      findMany: jest.fn(async ({ where }: { where: { realmId?: string } }) =>
        owned.filter((c) => !where.realmId || c.realmId === where.realmId)
      ),
    },
    realmOfficer: { findMany: jest.fn(async () => []) },
  };
}
const inEurth = [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 10 }];
const founder = { ...member, id: "u_f", clerkUserId: "founder" };
const noMod = { siteAdmin: false, realmIds: [], categoryIds: [] };
const ALLOWED_PERSONA_FIELDS = ["displayName", "username", "avatarUrl", "personaType"];

describe("thinkpagesForum router", () => {
  describe("a post's wikitext on the thread read", () => {
    function wikitextDb(thread: object = {}) {
      const db = forumDb(thread);
      db.forumPost.findMany.mockResolvedValue([
        {
          id: "p1",
          authorUserId: "u1",
          authorPersonaId: null,
          importedAuthorName: null,
          contentHtml: "<p>mine</p>",
          contentWikitext: "mine ''wiki''",
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
        {
          id: "p2",
          authorUserId: "u2",
          authorPersonaId: null,
          importedAuthorName: null,
          contentHtml: "<p>theirs</p>",
          contentWikitext: "theirs ''wiki''",
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
        {
          id: "p3",
          authorUserId: "u1",
          authorPersonaId: null,
          importedAuthorName: null,
          contentHtml: "<p>html only</p>",
          contentWikitext: null,
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
      ] as never);
      return db;
    }

    it("asks for it and returns it for the viewer's own editable posts only", async () => {
      const db = wikitextDb();
      const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
      expect(db.forumPost.findMany.mock.calls[0]?.[0]?.select).toMatchObject({
        contentWikitext: true,
      });
      expect(out.posts.map((p) => p.contentWikitext ?? null)).toEqual([
        "mine ''wiki''",
        null,
        null,
      ]);
      expect(JSON.stringify(out)).not.toContain("theirs ''wiki''");
    });

    it("sends it to nobody where the viewer may not edit: a locked thread, an anonymous reader, a moderator's view of others", async () => {
      const locked = await caller(member, wikitextDb({ locked: true })).thread({
        threadId: "t1",
        page: 1,
      });
      expect(JSON.stringify(locked)).not.toContain("''wiki''");
      const anon = await caller(null, wikitextDb()).thread({ threadId: "t1", page: 1 });
      expect(JSON.stringify(anon)).not.toContain("''wiki''");
      const asAdmin = await caller(admin, wikitextDb()).thread({ threadId: "t1", page: 1 });
      expect(JSON.stringify(asAdmin)).not.toContain("''wiki''");
    });
  });
  it("names each listed thread's last poster without the player behind a persona", async () => {
    const asMember = await caller(member, forumDb()).category({ key: "general", page: 1 });
    // The default last post (p1) is the persona's: the persona, never u1.
    expect(asMember.threads[0]!.lastPoster).toEqual({
      authorUserId: null,
      authorPersonaId: "pa1",
      importedAuthorName: null,
    });
    expect(asMember.authors.users).toEqual({});
    expect(asMember.authors.personas.pa1).toBeDefined();
    const asAdmin = await caller(admin, forumDb()).category({ key: "general", page: 1 });
    expect(asAdmin.threads[0]!.lastPoster).toEqual(asMember.threads[0]!.lastPoster);
    expect(asAdmin.authors.users).toEqual({});
  });
  it("returns display-safe authors and canStart on a category", async () => {
    const db = forumDb();
    const out = await caller(member, db).category({ key: "general", page: 1 });
    expect(out.canStart).toBe(true);
    // The listed thread is a persona thread: the player behind it gets no entry (flag, avatar or name).
    expect(out.authors.users).toEqual({});
    expect(Object.keys(out.authors.personas.pa1!).sort()).toEqual(
      [...ALLOWED_PERSONA_FIELDS].sort()
    );
    expect(JSON.stringify(out)).not.toContain("secret@example.com");
    expect(JSON.stringify(out)).not.toContain("clerk_1");
  });
  describe("thread page authors, numbers, roles and participants", () => {
    const post = (id: string, authorUserId: string | null, authorPersonaId: string | null) => ({
      id,
      authorUserId,
      authorPersonaId,
      importedAuthorName: null,
      contentHtml: `<p>${id}</p>`,
      editedAt: null,
      createdAt: when,
    });
    /** Thread by u1 (no persona); posts: u1 as persona pa1, u2 as themselves (an admin), u1 as themselves. */
    function pageDb(thread: object = {}) {
      const db = forumDb(thread);
      db.forumPost.findMany.mockResolvedValue([
        post("p1", "u1", "pa1"),
        post("p2", "u2", null),
        post("p3", "u1", null),
      ] as never);
      db.forumPost.groupBy.mockResolvedValue([
        {
          authorUserId: "u1",
          authorPersonaId: "pa1",
          importedAuthorName: null,
          _count: { _all: 4 },
        },
        {
          authorUserId: "u2",
          authorPersonaId: null,
          importedAuthorName: null,
          _count: { _all: 2 },
        },
      ] as never);
      db.user.findMany.mockImplementation((async ({ where }: { where: { id: { in: string[] } } }) =>
        [
          {
            ...rawUser,
            clerkUserId: "clerk_1",
            country: { name: "Caphiria", flag: "/f/caph.png" },
            role: null,
          },
          {
            ...rawUser,
            id: "u2",
            clerkUserId: "clerk_2",
            handle: "boss",
            country: null,
            role: { name: "admin", level: 10 },
          },
        ].filter((u) => where.id.in.includes(u.id))) as never);
      db.thinkpagesAccount.findMany.mockImplementation((async ({
        where,
      }: {
        where: { id?: unknown };
      }) =>
        where.id
          ? [{ ...rawPersona, profileImageUrl: "/p/news.png" }]
          : [{ clerkUserId: "clerk_1", profileImageUrl: "/p/heku.png" }]) as never);
      return db;
    }

    it("sends a persona post its persona's avatar and no player flag, avatar or name", async () => {
      const out = await caller(member, pageDb()).thread({ threadId: "t1", page: 1 });
      expect(out.authors.personas.pa1).toMatchObject({ avatarUrl: "/p/news.png" });
      expect(out.authors.personas.pa1).not.toHaveProperty("flagUrl");
      expect(out.authors.users.u2).toMatchObject({ name: "boss", flagUrl: null });
      // u1 appears as a player on p3 only, so their data is present once, for that post.
      expect(out.authors.users.u1).toMatchObject({
        flagUrl: "/f/caph.png",
        avatarUrl: "/p/heku.png",
      });
    });

    it("keeps a player whose only posts are persona posts out of the author maps", async () => {
      const db = pageDb({ authorUserId: "u9", authorPersonaId: "pa1" });
      db.forumPost.findMany.mockResolvedValue([post("p1", "u1", "pa1")] as never);
      db.forumPost.groupBy.mockResolvedValue([
        {
          authorUserId: "u1",
          authorPersonaId: "pa1",
          importedAuthorName: null,
          _count: { _all: 1 },
        },
      ] as never);
      const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
      expect(out.authors.users).toEqual({});
      expect(out.posts[0]!.role).toBe("starter");
      expect(JSON.stringify(out.participants)).not.toContain('"u1"');
    });

    it("sends a member no player id on persona posts or a persona thread, yet keeps byViewer for the author", async () => {
      const db = pageDb({ authorUserId: "u1", authorPersonaId: "pa1" });
      const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
      expect(out.posts.map((p) => p.authorUserId)).toEqual([null, "u2", "u1"]);
      expect(out.posts.map((p) => p.byViewer)).toEqual([true, false, true]);
      expect(out.thread.authorUserId).toBeNull();
      expect(out.viewerIsAuthor).toBe(true);
    });
    it("sends a member no player id on a persona thread in the category list, a moderator the id", async () => {
      const asMember = await caller(member, forumDb()).category({ key: "general", page: 1 });
      expect(asMember.threads[0]).toMatchObject({ authorPersonaId: "pa1", authorUserId: null });
      const asAdmin = await caller(admin, forumDb()).category({ key: "general", page: 1 });
      expect(asAdmin.threads[0]).toMatchObject({ authorPersonaId: "pa1", authorUserId: "u1" });
    });
  });
  it("strips hidden and gives no moderator tools to a member (T0-19)", async () => {
    const db = forumDb();
    db.forumPost.findMany.mockResolvedValue([
      {
        id: "p1",
        authorUserId: "u1",
        authorPersonaId: null,
        contentHtml: "<p>a</p>",
        editedAt: null,
        createdAt: when,
        hidden: false,
      },
    ] as never);
    const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
    expect(out.canModerate).toBe(false);
    expect(out.posts.every((p) => !("hidden" in p))).toBe(true);
    expect("moderatorTools" in out).toBe(false);
  });
  it("loads a realm category's realm once per category or thread read, and never returns it whole (N1)", async () => {
    const db = realmForumDb(inEurth);
    const category = await caller(member, db).category({ key: "hub", realm: "eurth", page: 1 });
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    db.realm.findUnique.mockClear();
    const thread = await caller(member, db).thread({ threadId: "t1", page: 1 });
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    for (const out of [category, thread]) {
      expect(out).not.toHaveProperty("forumRealm");
      expect(JSON.stringify(out)).not.toContain('"ownerId"');
    }
    expect(thread.canReply).toBe(true);
  });
  it("lists only the caller's active personas", async () => {
    const db = forumDb();
    const out = await caller(member, db).myPersonas();
    expect(out).toEqual([rawPersona]);
    expect(db.thinkpagesAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: "clerk_1", isActive: true, accountType: { not: "personal" } },
        select: { id: true, displayName: true, username: true },
      })
    );
  });
  describe("reports, standing and appeals", () => {
    beforeEach(() => jest.mocked(fileReport).mockClear());
    it("files a report as the signed-in member and returns only its id", async () => {
      const out = await caller(member, forumDb()).report({
        targetType: "post",
        targetId: "p2",
        reason: "  Spam here  ",
      });
      expect(out).toEqual({ reportId: "rep_1" });
      expect(fileReport).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "u1", mod: noMod }),
        { targetType: "post", targetId: "p2", reason: "Spam here" }
      );
    });
  });

  describe("realm sections", () => {
    it("gives a member's realm its emblem and thumbnail for the sidebar, and only these", async () => {
      const db = realmForumDb(inEurth);
      db.realm.findUnique.mockImplementation((async ({ select }: { select?: object }) => ({
        ...EURTH,
        ...(select && "emblemUrl" in select
          ? { emblemUrl: "https://img.example/e.png", thumbnail: "https://img.example/t.png" }
          : {}),
      })) as never);
      await expect(caller(member, db).navFlags()).resolves.toEqual({
        realmMember: true,
        forumModerator: false,
        realm: {
          slug: "eurth",
          name: "Eurth",
          emblemUrl: "https://img.example/e.png",
          thumbnail: "https://img.example/t.png",
        },
      });
    });
    it("returns a realm section with canPost and notice, never the raw posting access", async () => {
      const out = await caller(member, realmForumDb()).realmSection({ realm: "eurth" });
      expect(out).toMatchObject({
        realm: { slug: "eurth", name: "Eurth" },
        canPost: false,
        notice: NO_NATION,
      });
      expect(out.categories.map((c) => c.key)).toEqual(["hub"]);
      expect(Object.keys(out).sort()).toEqual([
        "banned",
        "canPost",
        "categories",
        "needsNation",
        "notice",
        "realm",
      ]);
      // U6: the claim-a-nation offer is the server's flag, not a match on the notice text.
      expect(out.needsNation).toBe(true);
      expect(JSON.stringify(out)).not.toContain("ownedCountryIds");
      expect(JSON.stringify(out)).not.toContain("restriction");
      const owner = await caller(member, realmForumDb(inEurth)).realmSection({ realm: "eurth" });
      expect(owner).toMatchObject({ canPost: true, notice: null, needsNation: false });
      const guest = await caller(null, realmForumDb()).realmSection({ realm: "eurth" });
      expect(guest).toMatchObject({ canPost: false, needsNation: false });
    });
    it("tells a realm moderator what they may do to each post and the thread; a member nothing (I-1, M-8)", async () => {
      const db = realmForumDb(inEurth);
      const by = (id: string, authorUserId: string) => ({
        id,
        authorUserId,
        authorPersonaId: null,
        contentHtml: "<p>x</p>",
        editedAt: null,
        createdAt: when,
        hidden: false,
      });
      db.forumThread.findUnique.mockResolvedValue({
        ...(await db.forumThread.findUnique()),
        authorUserId: "u_admin",
      } as never);
      db.forumPost.findMany.mockResolvedValue([
        by("p_member", "u1"),
        by("p_admin", "u_admin"),
        by("p_officer", "u_o"),
        by("p_own", "u_f"),
      ] as never);
      const role = (name: string, level: number) => ({ name, level });
      db.user.findMany.mockResolvedValue([
        { ...rawUser, role: role("user", 100) },
        { ...rawUser, id: "u_admin", clerkUserId: "clerk_admin", role: role("admin", 10) },
        { ...rawUser, id: "u_o", clerkUserId: "clerk_officer", role: role("user", 100) },
        { ...rawUser, id: "u_f", clerkUserId: "founder", role: role("user", 100) },
      ] as never);
      db.realmOfficer.findMany.mockResolvedValue([
        { realmId: "r_eurth", userId: "clerk_officer" },
      ] as never);
      const out = await caller(founder, db).thread({ threadId: "t1", page: 1 });
      expect(out.moderable).toBe(false);
      expect(
        out.posts.map(({ id, moderable, sanctionable }) => ({ id, moderable, sanctionable }))
      ).toEqual([
        { id: "p_member", moderable: true, sanctionable: true },
        { id: "p_admin", moderable: false, sanctionable: false },
        { id: "p_officer", moderable: true, sanctionable: false },
        { id: "p_own", moderable: true, sanctionable: false },
      ]);
      expect(JSON.stringify(out)).not.toContain("clerk_admin");

      const plain = await caller(member, realmForumDb(inEurth)).thread({ threadId: "t1", page: 1 });
      expect("moderable" in plain).toBe(false);
      expect(plain.posts.some((p) => "moderable" in p || "sanctionable" in p)).toBe(false);
    });

    it("marks hidden threads in a category for its moderators only (M-4)", async () => {
      const listed = (db: ReturnType<typeof realmForumDb>) => {
        db.forumThread.findMany.mockResolvedValue([
          {
            id: "t1",
            title: "Hello",
            authorUserId: "u1",
            authorPersonaId: null,
            pinned: false,
            locked: false,
            hidden: true,
            postCount: 1,
            lastPostAt: when,
          },
        ] as never);
        return db;
      };
      const forMod = await caller(founder, listed(realmForumDb())).category({
        key: "hub",
        page: 1,
        realm: "eurth",
      });
      expect(forMod.threads.map((t) => t.hidden)).toEqual([true]);
      const db = listed(realmForumDb(inEurth));
      const forMember = await caller(member, db).category({ key: "hub", page: 1, realm: "eurth" });
      expect(forMember.threads.every((t) => !("hidden" in t))).toBe(true);
      expect(db.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.objectContaining({ hidden: true }) })
      );
    });
  });
});

/**
 * Phase 4 (XenForo import): threads and posts whose XenForo author has no IxStats account carry a null
 * `authorUserId` and an `importedAuthorName`. The router never treats them as the viewer's, never asks for a null
 * user, passes the imported name through, and offers moderators hide but never a sanction on them.
 */
describe("imported authors on the thread and category reads", () => {
  const caller = (user: object | null, db: object) =>
    createCallerFactory(thinkpagesForumRouter)(
      createMockRouterContext({
        auth: user ? { userId: "clerk_1" } : null,
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
  const categories = SITE_CATEGORIES.map((c, i) => ({
    id: `cat_${c.key}`,
    scope: "site",
    realmId: null,
    ...c,
    order: i,
  }));
  const general = categories.find((c) => c.key === "general")!;
  const when = new Date("2026-10-01");
  const IMPORTED = { authorUserId: null, authorPersonaId: null, importedAuthorName: "OldName" };
  const postRow = (id: string, author: object) => ({
    id,
    contentHtml: `<p>${id}</p>`,
    editedAt: null,
    createdAt: when,
    hidden: false,
    ...author,
  });
  interface UserQuery {
    where: { id: { in: Array<string | null> } };
  }
  /** The imported thread's full row, XenForo user id and provenance included. */
  const threadRow = {
    id: "t_imported",
    title: "From the old forum",
    categoryId: general.id,
    ...IMPORTED,
    xenforoUserId: 77,
    xenforoThreadId: 1234,
    sourceRef: "xenforo_thread:1234",
    pinned: false,
    hidden: false,
    locked: false,
    archived: false,
    postCount: 2,
    lastPostAt: when,
    createdAt: when,
    category: general,
  };
  /** An imported thread in General: its first post imported, a reply by u1 (the member). */
  function importedDb() {
    return {
      ...engagementTables(),
      forumBan: forumBanFake([]),
      forumCategory: {
        findMany: jest.fn(async () => categories),
        findFirst: jest.fn(
          async ({ where }: { where: { key: string } }) =>
            categories.find((c) => c.key === where.key) ?? null
        ),
      },
      forumThread: {
        groupBy: jest.fn(async () => []),
        findMany: jest.fn(async () => [
          {
            id: "t_imported",
            title: "From the old forum",
            ...IMPORTED,
            pinned: false,
            locked: false,
            hidden: false,
            postCount: 2,
            lastPostAt: when,
          },
        ]),
        count: jest.fn(async () => 1),
        // Answers with the selected fields only, as Prisma does.
        findUnique: jest.fn(async ({ select }: { select: Record<string, boolean> }) =>
          Object.fromEntries(Object.entries(threadRow).filter(([field]) => select[field]))
        ),
      },
      forumPost: {
        findMany: jest.fn(async () => [
          postRow("p_imported", IMPORTED),
          postRow("p_member", {
            authorUserId: "u1",
            authorPersonaId: null,
            importedAuthorName: null,
          }),
        ]),
        count: jest.fn(async () => 2),
        groupBy: jest.fn(async () => []),
      },
      user: {
        findMany: jest.fn(async (_args: UserQuery) => [
          {
            id: "u1",
            clerkUserId: "clerk_1",
            handle: "heku",
            wikiUsername: null,
            country: null,
            role: { name: "user", level: 100 },
          },
        ]),
      },
      thinkpagesAccount: { findMany: jest.fn(async () => []) },
      realm: { findMany: jest.fn(async () => []) },
      realmOfficer: { findMany: jest.fn(async () => []) },
      forumCategoryModerator: { findMany: jest.fn(async () => []) },
    };
  }
  /** Every user id list the router asked the database for. */
  function askedUserIds(db: ReturnType<typeof importedDb>): Array<string | null> {
    return db.user.findMany.mock.calls.flatMap(([args]) => args.where.id.in);
  }
  describe("thinkpagesForum router with imported authors", () => {
    it("never marks an imported post or thread as the viewer's, and passes the imported name through", async () => {
      const db = importedDb();
      const out = await caller(member, db).thread({ threadId: "t_imported", page: 1 });
      expect(out.posts.map(({ id, byViewer, isOwn }) => ({ id, byViewer, isOwn }))).toEqual([
        { id: "p_imported", byViewer: false, isOwn: false },
        { id: "p_member", byViewer: true, isOwn: true },
      ]);
      expect(out.viewerIsAuthor).toBe(false);
      expect(out.posts[0]).toMatchObject({ authorUserId: null, importedAuthorName: "OldName" });
      expect(out.thread).toMatchObject({ authorUserId: null, importedAuthorName: "OldName" });
      expect(Object.keys(out.authors.users)).toEqual(["u1"]);
      // Authors, then the page's roles: both ask for real user ids only.
      expect([...new Set(askedUserIds(db))]).toEqual(["u1"]);
    });

    it("returns the thread's own fields and never its XenForo user id or provenance", async () => {
      const out = await caller(null, importedDb()).thread({ threadId: "t_imported", page: 1 });
      expect(out.thread).toEqual({
        id: "t_imported",
        title: "From the old forum",
        categoryId: general.id,
        ...IMPORTED,
        xenforoThreadId: 1234,
        pinned: false,
        hidden: false,
        locked: false,
        archived: false,
        postCount: 2,
        lastPostAt: when,
        createdAt: when,
      });
      expect(out.thread).not.toHaveProperty("xenforoUserId");
      expect(out.thread).not.toHaveProperty("sourceRef");
    });
  });
});

/**
 * What the forum router returns for a Find a Realm advert: the row mark and the page's advert view, never the raw
 * realm row that was joined to read it (it carries the founder's Clerk id), and a hidden realm's advert reads as gone.
 */
describe("adverts on the board list and the thread page", () => {
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
  const officer = { ...member, id: "u_off", clerkUserId: "officer" };
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
    it("decides the first post by the thread's first post, so a hidden first post does not move Edit to the next", async () => {
      const grants = [{ userId: "officer", powers: ["appearance"] }];
      const out = await caller(officer, advertDb(ACTIVE, grants, "p_hidden_first")).thread({
        threadId: "t_ad",
        page: 1,
      });
      expect(out.posts.map((p) => p.isOwn)).toEqual([false, false]);
    });
  });
});

describe("write hooks and refusals", () => {
  const NEW_THREAD = { categoryKey: "general", title: "Hello there", html: "<p>Hi</p>" };
  const NEW_ADVERT = { realm: "eurth", title: "Join Eurth", wikitext: "Come and play." };
  beforeEach(() => {
    for (const level of ["log", "info", "warn"] as const)
      jest.spyOn(console, level).mockImplementation(() => undefined);
    jest.mocked(afterThreadStarted).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("does not wait for the hook: a hook that never settles does not hold the response", async () => {
    jest.mocked(afterThreadStarted).mockReturnValueOnce(new Promise<void>(() => undefined));
    await expect(caller(member, forumDb()).createThread(NEW_THREAD)).resolves.toMatchObject({
      threadId: "t_new",
    });
  });

  it("runs no hook when the write is refused", async () => {
    jest.mocked(createThread).mockRejectedValueOnce(new ForumError("FORBIDDEN", "Nope"));
    await expect(caller(member, forumDb()).createThread(NEW_THREAD)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(afterThreadStarted).not.toHaveBeenCalled();
  });

  it("names the existing advert in a CONFLICT, and runs no hook", async () => {
    jest.mocked(createAdvert).mockRejectedValueOnce(
      new ForumError("CONFLICT", "This realm already has an advert.", undefined, {
        threadId: "t_old",
      })
    );
    await expect(caller(member, forumDb()).createAdvert(NEW_ADVERT)).rejects.toMatchObject({
      code: "CONFLICT",
      cause: { context: { threadId: "t_old" } },
    });
    expect(afterThreadStarted).not.toHaveBeenCalled();
  });

  it("publishes a rate-limit wait, and gives a plain refusal no cause", () => {
    const thrown = (error: Error): TRPCError => {
      try {
        mapError(error);
      } catch (caught) {
        if (caught instanceof TRPCError) return caught;
      }
      throw new Error("mapError did not throw a TRPCError");
    };
    const limited = thrown(new ForumError("TOO_MANY_REQUESTS", "slow", 12));
    expect(limited.code).toBe("TOO_MANY_REQUESTS");
    expect(limited.cause).toMatchObject({ context: { retryAfterSeconds: 12 } });
    expect(thrown(new ForumError("FORBIDDEN", "no")).cause).toBeUndefined();
  });
});
