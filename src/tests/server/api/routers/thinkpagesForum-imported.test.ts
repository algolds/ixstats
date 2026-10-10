/** @jest-environment node */
/**
 * Phase 4 (XenForo import): threads and posts whose XenForo author has no IxStats account carry a null
 * `authorUserId` and an `importedAuthorName`. The router never treats them as the viewer's, never asks for a null
 * user, passes the imported name through, and offers moderators hide but never a sanction on them.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { forumBanFake } from "~/tests/helpers/forum-ban-fake";

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
const admin = { ...member, id: "u_admin", role: { name: "admin", level: 10 } };

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

  it("gives an anonymous reader the imported names without asking for any user", async () => {
    const db = importedDb();
    db.forumPost.findMany.mockResolvedValue([postRow("p_imported", IMPORTED)] as never);
    const out = await caller(null, db).thread({ threadId: "t_imported", page: 1 });
    expect(out.posts[0]).toMatchObject({ importedAuthorName: "OldName", isOwn: false });
    expect(out.authors.users).toEqual({});
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("lists an imported thread with its imported name and no user lookup for it", async () => {
    const db = importedDb();
    const out = await caller(member, db).category({ key: "general", page: 1 });
    expect(out.threads[0]).toMatchObject({ authorUserId: null, importedAuthorName: "OldName" });
    expect(out.authors.users).toEqual({});
    expect(askedUserIds(db)).toEqual([]);
  });

  it("offers a moderator hide and edit on imported content, never a sanction", async () => {
    const db = importedDb();
    const out = await caller(admin, db).thread({ threadId: "t_imported", page: 1 });
    expect(out.moderable).toBe(true);
    expect(
      out.posts.map(({ id, moderable, sanctionable }) => ({ id, moderable, sanctionable }))
    ).toEqual([
      { id: "p_imported", moderable: true, sanctionable: false },
      { id: "p_member", moderable: true, sanctionable: true },
    ]);
    expect(askedUserIds(db)).not.toContain(null);
  });
});
